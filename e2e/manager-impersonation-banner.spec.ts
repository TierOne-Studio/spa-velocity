import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserRecord,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
  withDatabase,
} from './test-helpers';

const PASSWORD = 'ManagerImpersonation123!';
const managerActorEmail = uniqueEmail('e2e-manager-impersonation-actor');
const memberTargetEmail = uniqueEmail('e2e-manager-impersonation-target');
const orgSlug = `e2e-manager-impersonation-org-${Date.now()}`;

const defaultManagerPermissions = [
  ['user', 'read'],
  ['user', 'update'],
  ['user', 'ban'],
  ['session', 'read'],
  ['session', 'revoke'],
  ['organization', 'read'],
  ['organization', 'invite'],
  ['role', 'read'],
  ['role', 'assign'],
  ['role', 'update'],
] as const;

const managerPermissionsWithImpersonate = [
  ...defaultManagerPermissions,
  ['user', 'impersonate'],
] as const;

let organizationId = '';

async function setManagerPermissions(
  permissions: ReadonlyArray<readonly [string, string]>,
): Promise<void> {
  await withDatabase(async (pool) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM role_permissions
         WHERE role_id = (SELECT id FROM roles WHERE name = 'manager')`,
      );

      for (const [resource, action] of permissions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT r.id, p.id
           FROM roles r
           JOIN permissions p ON p.resource = $2 AND p.action = $3
           WHERE r.name = $1
           ON CONFLICT DO NOTHING`,
          ['manager', resource, action],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}

async function loginAsManager(page: Page) {
  await loginWithCredentials(page, managerActorEmail, PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: managerActorEmail,
    organizationId,
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function openUsersPage(page: Page) {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: /users/i })).toBeVisible({ timeout: 15000 });
}

async function findUserRowByEmail(page: Page, email: string): Promise<Locator> {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible();
  await searchInput.fill(email);
  await page.waitForTimeout(800);

  const row = page.locator('table tbody tr', { hasText: email }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  return row;
}

test.describe.serial('Manager impersonation banner flow', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: managerActorEmail,
      password: PASSWORD,
      name: 'E2E Manager Impersonation Actor',
      role: 'manager',
    });

    await ensureUserRecord({
      email: memberTargetEmail,
      name: 'E2E Manager Impersonation Target',
      role: 'member',
    });

    organizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E Manager Impersonation Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberTargetEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E Manager Impersonation Org',
    });

    await setManagerPermissions(managerPermissionsWithImpersonate);
  });

  test.afterAll(async () => {
    await setManagerPermissions(defaultManagerPermissions);
  });

  test('manager can see impersonation banner and stop impersonating after impersonating a member', async ({ page }) => {
    await loginAsManager(page);
    await openUsersPage(page);

    const memberRow = await findUserRowByEmail(page, memberTargetEmail);
    const actionButton = memberRow.getByRole('button');
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await expect(page.getByRole('menuitem', { name: /impersonate user|impersonate/i })).toBeVisible();
    await page.getByRole('menuitem', { name: /impersonate user|impersonate/i }).click();

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');

    const banner = page.locator('.bg-amber-500');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner.getByText(/you are impersonating/i)).toBeVisible();
    await expect(banner.getByRole('button', { name: /stop impersonating/i })).toBeVisible();

    await banner.getByRole('button', { name: /stop impersonating/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(banner).not.toBeVisible();
  });
});
