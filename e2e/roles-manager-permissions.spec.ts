import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
  withDatabase,
} from './test-helpers';

const PASSWORD = 'RolesManagerCreate123!';
const managerEmail = uniqueEmail('e2e-role-create-manager');
const orgSlug = `e2e-role-create-org-${Date.now()}`;

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

const managerPermissionsWithRoleCreate = [
  ...defaultManagerPermissions,
  ['role', 'create'],
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
  await loginWithCredentials(page, managerEmail, PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: managerEmail,
    organizationId,
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function openRolesPage(page: Page) {
  await page.goto('/admin/roles');
  await expect(page).toHaveURL('/admin/roles', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /roles & permissions/i })).toBeVisible({ timeout: 15000 });
}

test.describe.serial('Roles page manager permission flow', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: managerEmail,
      password: PASSWORD,
      name: 'E2E Manager Role Create',
      role: 'manager',
    });

    organizationId = await ensureOrganizationMembership({
      userEmail: managerEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E Role Create Organization',
    });

    await setManagerPermissions(managerPermissionsWithRoleCreate);
  });

  test.afterAll(async () => {
    await setManagerPermissions(defaultManagerPermissions);
  });

  test('manager with role:create can view member role and access the create role dialog', async ({ page }) => {
    await loginAsManager(page);
    await openRolesPage(page);

    await expect(page.getByRole('button', { name: /create role/i })).toBeVisible();
    await expect(page.locator('[data-testid="role-card-member"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-card-admin"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="role-card-manager"]')).not.toBeVisible();

    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /name \(identifier\)/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /display name/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible();
  });
});
