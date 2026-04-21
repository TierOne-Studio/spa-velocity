import { expect, type Locator, type Page } from '@playwright/test';
import { Pool } from 'pg';

import { API_BASE_URL, DATABASE_URL } from './env';
import { uniqueResendDeliveredEmail } from '../src/shared/utils/resendTestEmail';

export type AppRole = 'admin' | 'manager' | 'member';

const MANAGER_ROLE_PERMISSIONS = [
  ['organization', 'read'],
  ['organization', 'update'],
  ['organization', 'invite'],
  ['role', 'read'],
  ['session', 'read'],
  ['session', 'revoke'],
  ['user', 'create'],
  ['user', 'read'],
  ['user', 'update'],
] as const;

const MEMBER_ROLE_PERMISSIONS = [
  ['organization', 'read'],
] as const;

async function seedDefaultOrganizationRoles(pool: Pool, organizationId: string): Promise<void> {
  await pool.query(
    `INSERT INTO roles (name, display_name, description, color, is_default, organization_id)
     VALUES
       ('admin', 'Admin', 'Organization administrator with full access within their organization', 'red', true, $1),
       ('manager', 'Manager', 'Organization manager with elevated operational access within their organization', 'blue', true, $1),
       ('member', 'Member', 'Organization member with basic access within their organization', 'gray', true, $1)
     ON CONFLICT (organization_id, name) WHERE organization_id IS NOT NULL DO UPDATE SET
       display_name = EXCLUDED.display_name,
       description = EXCLUDED.description,
       color = EXCLUDED.color,
       is_default = EXCLUDED.is_default,
       updated_at = NOW()`,
    [organizationId],
  );

  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id
     FROM roles r
     CROSS JOIN permissions p
     WHERE r.organization_id = $1
       AND r.name = 'admin'
     ON CONFLICT DO NOTHING`,
    [organizationId],
  );

  await pool.query(
    `DELETE FROM role_permissions rp
     USING roles r
     WHERE rp.role_id = r.id
       AND r.organization_id = $1
       AND r.name = 'manager'`,
    [organizationId],
  );

  for (const [resource, action] of MANAGER_ROLE_PERMISSIONS) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       JOIN permissions p ON p.resource = $2 AND p.action = $3
       WHERE r.organization_id = $1
         AND r.name = 'manager'
       ON CONFLICT DO NOTHING`,
      [organizationId, resource, action],
    );
  }

  await pool.query(
    `DELETE FROM role_permissions rp
     USING roles r
     WHERE rp.role_id = r.id
       AND r.organization_id = $1
       AND r.name = 'member'`,
    [organizationId],
  );

  for (const [resource, action] of MEMBER_ROLE_PERMISSIONS) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       JOIN permissions p ON p.resource = $2 AND p.action = $3
       WHERE r.organization_id = $1
         AND r.name = 'member'
       ON CONFLICT DO NOTHING`,
      [organizationId, resource, action],
    );
  }
}

/**
 * Ensures the test user exists via the signup API and sets them as superadmin.
 * Call this in beforeAll blocks of test files that run later in the suite,
 * in case an earlier test inadvertently removed the user.
 */
export async function ensureTestUserExists(params: {
  email: string;
  password: string;
  name: string;
}): Promise<void> {
  const exists = await withDatabase(async (pool) => {
    const res = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [params.email]);
    return (res.rowCount ?? 0) > 0;
  });

  if (!exists) {
    await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        name: params.name,
      }),
    });
  }

  await withDatabase(async (pool) => {
    await pool.query(
      `UPDATE "user"
       SET role = 'superadmin', "emailVerified" = true, "approvalStatus" = 'approved', "updatedAt" = NOW()
       WHERE email = $1`,
      [params.email],
    );
    await pool.query(
      `DELETE FROM session WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)`,
      [params.email],
    );
  });
}

export async function withDatabase<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

export function uniqueEmail(prefix: string): string {
  const normalizedPrefix = prefix.startsWith('e2e-') ? prefix : `e2e-${prefix}`;
  return uniqueResendDeliveredEmail(normalizedPrefix);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function ensureOrganizationExists(params: {
  orgSlug: string;
  orgName: string;
}): Promise<string> {
  return await withDatabase(async (pool) => {
    const orgResult = await pool.query<{ id: string }>(
      `INSERT INTO organization (id, name, slug, "createdAt", metadata)
       VALUES (gen_random_uuid()::text, $1, $2, NOW(), NULL)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [params.orgName, params.orgSlug],
    );

    const organizationId = orgResult.rows[0].id;
    await seedDefaultOrganizationRoles(pool, organizationId);
    return organizationId;
  });
}

export async function ensureUserWithRole(params: {
  email: string;
  password: string;
  name: string;
  role: AppRole;
}): Promise<{ id: string; email: string; password: string }> {
  let signupFailureDetails: string | null = null;

  const signupResponse = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      name: params.name,
    }),
  });

  if (!signupResponse.ok) {
    const error = await signupResponse
      .json()
      .catch(async () => ({ message: await signupResponse.text().catch(() => '') }));
    const message = String((error as { message?: string }).message ?? '').toLowerCase();
    const alreadyExists = message.includes('exist') || message.includes('already');
    if (!alreadyExists) {
      signupFailureDetails = `status=${signupResponse.status} body=${JSON.stringify(error)}`;
    }
  }

  const userId = await withDatabase(async (pool) => {
    const result = await pool.query<{ id: string }>(
      `UPDATE "user"
       SET role = $1, "emailVerified" = true, "approvalStatus" = 'approved', "updatedAt" = NOW()
       WHERE email = $2
       RETURNING id`,
      [params.role, params.email],
    );

    if (result.rowCount === 0) {
      throw new Error(
        `User not found after creation attempt: ${params.email}${
          signupFailureDetails ? ` (${signupFailureDetails})` : ''
        }`,
      );
    }

    await pool.query(`DELETE FROM session WHERE "userId" = $1`, [result.rows[0].id]);

    return result.rows[0].id;
  });

  return {
    id: userId,
    email: params.email,
    password: params.password,
  };
}

export async function ensureUserRecord(params: {
  email: string;
  name: string;
  role: AppRole;
}): Promise<{ id: string; email: string }> {
  const userId = await withDatabase(async (pool) => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "approvalStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, true, 'approved', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             role = EXCLUDED.role,
             "emailVerified" = true,
             "approvalStatus" = 'approved',
             "updatedAt" = NOW()
       RETURNING id`,
      [params.name, params.email, params.role],
    );

    await pool.query(`DELETE FROM session WHERE "userId" = $1`, [result.rows[0].id]);

    return result.rows[0].id;
  });

  return {
    id: userId,
    email: params.email,
  };
}

export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export async function loginWithCredentials(page: Page, email: string, password: string): Promise<void> {
  await clearAuthState(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^login$/i }).click();
  // Root route (/) redirects to /chat or /account depending on permissions.
  // Under the full suite the auth round-trip can occasionally take longer, so retry once before failing.
  try {
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30000 });
  } catch {
    await page.getByRole('button', { name: /^login$/i }).click();
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30000 });
  }
  await page.waitForLoadState('networkidle');
}

export async function ensureOrganizationMembership(params: {
  userEmail: string;
  role: 'admin' | 'manager' | 'member';
  orgSlug: string;
  orgName: string;
}): Promise<string> {
  return await withDatabase(async (pool) => {
    const userResult = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [params.userEmail],
    );

    if (userResult.rowCount === 0) {
      throw new Error(`Cannot find user for organization membership: ${params.userEmail}`);
    }

    const userId = userResult.rows[0].id;

    const organizationId = await (async () => {
      const orgResult = await pool.query<{ id: string }>(
        `INSERT INTO organization (id, name, slug, "createdAt", metadata)
         VALUES (gen_random_uuid()::text, $1, $2, NOW(), NULL)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [params.orgName, params.orgSlug],
      );

      const orgId = orgResult.rows[0].id;
      await seedDefaultOrganizationRoles(pool, orgId);
      return orgId;
    })();

    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [organizationId, userId, params.role],
    );

    return organizationId;
  });
}

export async function setActiveOrganizationForUserSessions(params: {
  userEmail: string;
  organizationId: string;
}): Promise<void> {
  await withDatabase(async (pool) => {
    await pool.query(
      `UPDATE session
       SET "activeOrganizationId" = $1
       WHERE "userId" IN (SELECT id FROM "user" WHERE email = $2)`,
      [params.organizationId, params.userEmail],
    );
  });
}

/**
 * Switch active organization via Better Auth on the client side, then reload.
 *
 * Use this instead of `setActiveOrganizationForUserSessions` (DB-only) when the
 * test needs the client's cached session + React Query permissions to refresh
 * with the new active org — e.g. non-superadmin users whose `can()` checks
 * depend on per-org permissions fetched at bootstrap.
 */
export async function setActiveOrganizationViaSession(
  page: Page,
  organizationId: string,
): Promise<void> {
  await page.evaluate(
    async ({ apiBaseUrl, nextOrganizationId }) => {
      const token = window.localStorage.getItem('bearer_token');
      const response = await fetch(`${apiBaseUrl}/api/auth/organization/set-active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ organizationId: nextOrganizationId }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`Failed to set active organization: ${response.status} ${error}`);
      }
    },
    { apiBaseUrl: API_BASE_URL, nextOrganizationId: organizationId },
  );
  await page.reload({ waitUntil: 'networkidle' });
}

export async function findOrganizationListItemBySlug(page: Page, slug: string): Promise<Locator> {
  const searchInput = page.getByPlaceholder(/search organizations/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(slug);
  await page.waitForTimeout(500);

  const targetOrg = page
    .locator('[role="button"]')
    .filter({ hasText: new RegExp(`/${escapeRegExp(slug)}\\b`, 'i') })
    .first();

  await expect(targetOrg).toBeVisible({ timeout: 15000 });
  return targetOrg;
}
