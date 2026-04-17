import { test, expect, type APIRequestContext, type Locator, Page } from '@playwright/test';
import { Pool } from 'pg';
import { DATABASE_URL, API_BASE_URL, TEST_USER } from './env';
import { ensureOrganizationMembership, ensureTestUserExists, findOrganizationListItemBySlug } from './test-helpers';
import { resendTestEmail } from '../src/shared/utils/resendTestEmail';

// Re-export helpers that spec files need directly
export { ensureTestUserExists, findOrganizationListItemBySlug };

export const MANAGER_ORG_SLUG = 'manager-org';

// Database helper
export async function withDatabase<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

// Set user role and clear sessions
export async function setUserRole(role: 'superadmin' | 'admin' | 'manager' | 'member') {
  await withDatabase(async (pool) => {
    await pool.query(`UPDATE "user" SET role = $1 WHERE email = $2`, [role, TEST_USER.email]);
    await pool.query(`DELETE FROM session WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)`, [TEST_USER.email]);
    console.log(`Set user role to: ${role}`);
  });
}

export async function ensureOrganizationForTestUser(params: {
  orgSlug: string;
  orgName: string;
  memberRole: 'admin' | 'manager' | 'member';
}) {
  return await withDatabase(async (pool) => {
    const userRow = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [TEST_USER.email]);
    if (userRow.rowCount === 0) {
      throw new Error('Test user not found in database');
    }
    const userId = userRow.rows[0].id as string;

    const organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: params.memberRole,
      orgSlug: params.orgSlug,
      orgName: params.orgName,
    });

    return { organizationId, userId };
  });
}

export async function setActiveOrganizationForUserSessions(organizationId: string) {
  await withDatabase(async (pool) => {
    await pool.query(
      `UPDATE session
       SET "activeOrganizationId" = $1
       WHERE "userId" IN (SELECT id FROM "user" WHERE email = $2)`,
      [organizationId, TEST_USER.email],
    );
  });
}

export async function setActiveOrganization(page: Page, organizationId: string) {
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
}

// Seed a member user for admin to act on
export async function ensureMemberUser(emailPrefix: string) {
  return await withDatabase(async (pool) => {
    const email = resendTestEmail('delivered', emailPrefix);
    const name = `Member ${emailPrefix}`;
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "approvalStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'member', true, 'approved', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             role = 'member',
             "emailVerified" = true,
             "approvalStatus" = 'approved',
             "updatedAt" = NOW()
       RETURNING id`,
      [name, email],
    );
    const userId = userResult.rows[0].id;
    await pool.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'credential', $1, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    return { userId, email };
  });
}

export async function ensureMemberUserInOrganization(emailPrefix: string, organizationId: string) {
  const { userId, email } = await ensureMemberUser(emailPrefix);

  await withDatabase(async (pool) => {
    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       SELECT gen_random_uuid()::text, $1, $2, 'member', NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2
       )`,
      [organizationId, userId],
    );
  });

  return { userId, email };
}

export async function ensureUserInOrganization(params: {
  emailPrefix: string;
  userRole: 'admin' | 'manager' | 'member';
  organizationId: string;
  memberRole: 'admin' | 'manager' | 'member';
}) {
  return await withDatabase(async (pool) => {
    const email = resendTestEmail('delivered', params.emailPrefix);

    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "approvalStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, true, 'approved', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET role = EXCLUDED.role,
             "emailVerified" = true,
         "approvalStatus" = 'approved',
             "updatedAt" = NOW()
       RETURNING id`,
      [`${params.userRole} ${params.emailPrefix}`, email, params.userRole],
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       SELECT gen_random_uuid()::text, $1, $2, $3, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2
       )`,
      [params.organizationId, userId, params.memberRole],
    );

    await pool.query(
      `UPDATE member SET role = $3
       WHERE "organizationId" = $1 AND "userId" = $2`,
      [params.organizationId, userId, params.memberRole],
    );

    return { userId, email };
  });
}

// Login helper
export async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export async function signInAndGetAuthHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const signInRes = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });

  expect(signInRes.status()).toBe(200);
  const signInData = await signInRes.json();
  const token = signInData.token || signInData.session?.token;

  if (!token) {
    throw new Error('Authentication succeeded but no token was returned from sign-in response');
  }

  return { Authorization: `Bearer ${token}` };
}

export async function findUserRowByEmail(page: Page, email: string): Promise<Locator> {
  const searchTerm = await withDatabase(async (pool) => {
    const result = await pool.query<{ name: string }>(`SELECT name FROM "user" WHERE email = $1`, [email]);
    return result.rows[0]?.name ?? email;
  });

  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(searchTerm);
  await page.waitForTimeout(800);

  const targetRow = page.locator('table tbody tr', { hasText: email }).first();
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  return targetRow;
}

export async function openActionsMenuForUserEmail(page: Page, email: string): Promise<void> {
  const row = await findUserRowByEmail(page, email);
  const actionBtn = row.getByRole('button', { name: /open menu/i });
  await expect(actionBtn).toBeVisible();
  await actionBtn.click();
}
