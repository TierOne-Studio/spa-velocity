import { test, expect } from '@playwright/test';
import { resendTestEmail } from '../../src/shared/utils/resendTestEmail';
import {
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganizationForUserSessions,
  withDatabase,
} from '../rbac-role-helpers';

test.describe.serial('Organization Scoping - Manager Restrictions', () => {
  let managerOrgId: string;
  let otherOrgId: string;
  let userInManagerOrg: string;
  let userInOtherOrg: string;

  test.beforeAll(async () => {
    await setUserRole('admin');

    const { organizationId: org1 } = await ensureOrganizationForTestUser({
      orgSlug: 'scoping-org-1',
      orgName: 'Scoping Org 1',
      memberRole: 'manager',
    });
    managerOrgId = org1;

    await withDatabase(async (pool) => {
      const org2Result = await pool.query(
        `INSERT INTO organization (id, name, slug, "createdAt", metadata)
         VALUES (gen_random_uuid()::text, $1, $2, NOW(), NULL)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        ['Scoping Org 2', 'scoping-org-2']
      );
      otherOrgId = org2Result.rows[0].id;

      const user1Result = await pool.query(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, false, NOW(), NOW())
         RETURNING id`,
        ['User In Manager Org', resendTestEmail('delivered', `e2e-user-in-mgr-org-${Date.now()}`), 'member']
      );
      userInManagerOrg = user1Result.rows[0].id;

      await pool.query(
        `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
        [managerOrgId, userInManagerOrg, 'member']
      );

      const user2Result = await pool.query(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, false, NOW(), NOW())
         RETURNING id`,
        ['User In Other Org', resendTestEmail('delivered', `e2e-user-in-other-org-${Date.now()}`), 'member']
      );
      userInOtherOrg = user2Result.rows[0].id;

      await pool.query(
        `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
        [otherOrgId, userInOtherOrg, 'member']
      );
    });

    await setUserRole('manager');
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(managerOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('manager can access users page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
  });
});
