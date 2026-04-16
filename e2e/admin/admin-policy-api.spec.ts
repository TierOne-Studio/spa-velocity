import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { API_BASE_URL, DATABASE_URL, TEST_USER } from '../env';
import { ensureOrganizationExists, uniqueEmail } from '../test-helpers';

const CAPABILITIES_ORG_SLUG = `e2e-policy-api-org-${Date.now()}`;
const CAPABILITIES_ORG_NAME = 'E2E Policy API Org';

async function withDatabase<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function signInAndGetHeaders(request: import('@playwright/test').APIRequestContext): Promise<Record<string, string>> {
  const signInRes = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });

  expect(signInRes.status()).toBe(200);
  const signInData = await signInRes.json();
  const token = signInData.token || signInData.session?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function setActiveOrganizationForUserSessions(userEmail: string, organizationId: string): Promise<void> {
  await withDatabase(async (pool) => {
    await pool.query(
      `UPDATE session SET "activeOrganizationId" = $1
       WHERE "userId" IN (SELECT id FROM "user" WHERE email = $2)`,
      [organizationId, userEmail],
    );
  });
}

async function ensureAdminActor(): Promise<string> {
  return withDatabase(async (pool) => {
    const userResult = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [TEST_USER.email],
    );

    if (userResult.rowCount === 0) {
      throw new Error(`Test user not found: ${TEST_USER.email}`);
    }

    const userId = userResult.rows[0].id;

    await pool.query(
      `UPDATE "user" SET role = 'superadmin', "emailVerified" = true, "updatedAt" = NOW() WHERE id = $1`,
      [userId],
    );

    return userId;
  });
}

async function ensureUser(email: string, name: string, role: 'admin' | 'manager' | 'member'): Promise<string> {
  return withDatabase(async (pool) => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET role = EXCLUDED.role,
             name = EXCLUDED.name,
             "emailVerified" = true,
             "updatedAt" = NOW()
       RETURNING id`,
      [name, email, role],
    );

    return result.rows[0].id;
  });
}

async function createOrganization(slug: string, name: string): Promise<string> {
  return ensureOrganizationExists({ orgSlug: slug, orgName: name });
}

async function ensureMember(organizationId: string, userId: string, role: 'admin' | 'manager' | 'member'): Promise<string> {
  return withDatabase(async (pool) => {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM member WHERE "organizationId" = $1 AND "userId" = $2`,
      [organizationId, userId],
    );

    if (existing.rowCount && existing.rows[0]) {
      await pool.query(`UPDATE member SET role = $1 WHERE id = $2`, [role, existing.rows[0].id]);
      return existing.rows[0].id;
    }

    const result = await pool.query<{ id: string }>(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
       RETURNING id`,
      [organizationId, userId, role],
    );

    return result.rows[0].id;
  });
}

test.describe('Admin policy API coverage', () => {
  let organizationId = '';

  test.beforeAll(async () => {
    await ensureAdminActor();
    organizationId = await createOrganization(CAPABILITIES_ORG_SLUG, CAPABILITIES_ORG_NAME);
  });

  test('GET /api/password-policy should expose backend policy', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/password-policy`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ minLength: 8 });
  });

  test('GET /api/admin/users/:id/capabilities should return backend-driven action matrix', async ({ request }) => {
    const targetMemberId = await ensureUser(
      uniqueEmail('e2e-cap-member'),
      'E2E Cap Member',
      'member',
    );
    const targetAdminId = await ensureUser(
      uniqueEmail('e2e-cap-admin'),
      'E2E Cap Admin',
      'admin',
    );

    await ensureMember(organizationId, targetMemberId, 'member');
    await ensureMember(organizationId, targetAdminId, 'admin');

    const adminUserId = await ensureAdminActor();
    await ensureMember(organizationId, adminUserId, 'admin');

    const headers = await signInAndGetHeaders(request);
    await setActiveOrganizationForUserSessions(TEST_USER.email, organizationId);

    const memberResponse = await request.get(`${API_BASE_URL}/api/admin/users/${targetMemberId}/capabilities`, { headers });
    expect(memberResponse.status()).toBe(200);
    const memberBody = await memberResponse.json();
    expect(memberBody.actions.update).toBe(true);
    expect(memberBody.actions.remove).toBe(true);
    expect(memberBody.actions.impersonate).toBe(true);

    const adminResponse = await request.get(`${API_BASE_URL}/api/admin/users/${targetAdminId}/capabilities`, { headers });
    expect(adminResponse.status()).toBe(200);
    const adminBody = await adminResponse.json();
    expect(adminBody.actions.setRole).toBe(true);
    expect(adminBody.actions.remove).toBe(true);
    expect(adminBody.actions.impersonate).toBe(true);
  });

  test('superadmin can demote and remove the last organization admin via API', async ({ request }) => {
    const headers = await signInAndGetHeaders(request);

    const suffix = Date.now();
    const orgId = await createOrganization(`e2e-policy-org-${suffix}`, `E2E Policy Org ${suffix}`);
    const loneAdminUserId = await ensureUser(uniqueEmail('e2e-last-admin'), 'E2E Last Admin', 'member');
    const loneAdminMemberId = await ensureMember(orgId, loneAdminUserId, 'admin');

    const demoteResponse = await request.put(
      `${API_BASE_URL}/api/platform-admin/organizations/${orgId}/members/${loneAdminMemberId}/role`,
      {
        headers,
        data: { role: 'member' },
      },
    );
    expect(demoteResponse.status()).toBe(200);

    const removeResponse = await request.delete(
      `${API_BASE_URL}/api/platform-admin/organizations/${orgId}/members/${loneAdminMemberId}`,
      { headers },
    );
    expect(removeResponse.status()).toBe(200);
  });

  test('organization invitation lifecycle should use platform-admin endpoints', async ({ request }) => {
    const headers = await signInAndGetHeaders(request);

    const suffix = Date.now();
    const orgId = await createOrganization(`e2e-invite-org-${suffix}`, `E2E Invite Org ${suffix}`);
    const inviteEmail = uniqueEmail('e2e-invitee');

    const createInviteResponse = await request.post(
      `${API_BASE_URL}/api/platform-admin/organizations/${orgId}/invitations`,
      {
        headers,
        data: { email: inviteEmail, role: 'member' },
      },
    );
    expect([200, 201]).toContain(createInviteResponse.status());

    const createdInvitationBody = await createInviteResponse.json();
    const invitationId = createdInvitationBody?.data?.id as string | undefined;
    expect(invitationId).toBeTruthy();

    const deleteInviteResponse = await request.delete(
      `${API_BASE_URL}/api/platform-admin/organizations/${orgId}/invitations/${invitationId}`,
      { headers },
    );
    expect(deleteInviteResponse.status()).toBe(200);
  });
});
