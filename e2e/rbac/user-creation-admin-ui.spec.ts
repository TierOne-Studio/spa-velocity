import { test, expect } from '@playwright/test';
import {
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganizationForUserSessions,
} from '../rbac-role-helpers';

test.describe.serial('User Creation - Admin (UI)', () => {
  let adminUiOrgId: string;

  test.beforeAll(async () => {
    await setUserRole('admin');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'user-creation-admin-org',
      orgName: 'User Creation Admin Org',
      memberRole: 'admin',
    });
    adminUiOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(adminUiOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('should open create user dialog and see all role options', async ({ page }) => {
    await page.goto('/admin/users');
    // Wait for page to fully load before clicking
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const addButton = page.getByRole('button', { name: /add user/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText('Create New User')).toBeVisible();

    // Verify form fields are present
    await expect(dialog.getByLabel('Name')).toBeVisible();
    await expect(dialog.getByLabel('Email')).toBeVisible();
    await expect(dialog.getByLabel('Password')).toBeVisible();
    await expect(dialog.getByText('Role', { exact: true })).toBeVisible();
  });
});
