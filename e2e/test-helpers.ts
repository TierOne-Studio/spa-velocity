import { expect, type Page } from '@playwright/test';
import { Pool } from 'pg';

import { API_BASE_URL, DATABASE_URL } from './env';
import { uniqueResendDeliveredEmail } from '../src/shared/utils/resendTestEmail';

export type AppRole = 'admin' | 'manager' | 'member';

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
       SET role = $1, "emailVerified" = true, "updatedAt" = NOW()
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
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             role = EXCLUDED.role,
             "emailVerified" = true,
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
  await expect(page).toHaveURL('/', { timeout: 15000 });
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

    const orgResult = await pool.query<{ id: string }>(
      `INSERT INTO organization (id, name, slug, "createdAt", metadata)
       VALUES (gen_random_uuid()::text, $1, $2, NOW(), NULL)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [params.orgName, params.orgSlug],
    );

    const organizationId = orgResult.rows[0].id;

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
