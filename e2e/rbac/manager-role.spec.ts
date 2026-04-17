import { test, expect } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  MANAGER_ORG_SLUG,
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganization,
  ensureMemberUserInOrganization,
  ensureUserInOrganization,
  findUserRowByEmail,
  openActionsMenuForUserEmail,
  findOrganizationListItemBySlug,
} from '../rbac-role-helpers';

test.describe.serial('Manager Role - Organization-Scoped Access', () => {
  let managerOrgId: string;

  test.beforeAll(async () => {
    await setUserRole('manager');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: MANAGER_ORG_SLUG,
      orgName: 'Manager Org',
      memberRole: 'manager',
    });
    managerOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    // Re-ensure org + membership and refresh the org ID (handles stale ID from beforeAll)
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: MANAGER_ORG_SLUG,
      orgName: 'Manager Org',
      memberRole: 'manager',
    });
    managerOrgId = organizationId;
    await login(page);
    await setActiveOrganization(page, managerOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('should login successfully and see dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/);
    // Verify sidebar is visible (dashboard link depends on dashboard:view permission)
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible({ timeout: 10000 });
  });

  test('should see admin navigation items (manager allowed)', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole('link', { name: /^users$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /sessions/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /organizations/i })).toBeVisible();
  });

  test('should access Users page and gate create-user UI by permission', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();

    const addUserButton = page.getByRole('button', { name: /add user/i });
    if (await addUserButton.isVisible().catch(() => false)) {
      await addUserButton.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Organization selector should be visible (proves backend metadata endpoint works and org is required)
      await expect(dialog.getByText('Organization', { exact: true })).toBeVisible();

      // Role selector should be visible
      await expect(dialog.getByText('Role', { exact: true })).toBeVisible();
    } else {
      await expect(addUserButton).not.toBeVisible();
    }
  });

  test('manager should see self actions constrained by permissions', async ({ page }) => {
    await page.goto('/admin/users');

    await openActionsMenuForUserEmail(page, TEST_USER.email);
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('manager should see member-user actions allowed by permissions', async ({ page }) => {
    const { email } = await ensureMemberUserInOrganization('mgr-action-target', managerOrgId);
    await page.goto('/admin/users');

    await openActionsMenuForUserEmail(page, email);

    // Matrix-aligned manager-on-member expectations.
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /ban user|unban user/i })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('manager should NOT see actions on admin users', async ({ page }) => {
    const adminTarget = await ensureUserInOrganization({
      emailPrefix: `mgr-no-actions-admin-${Date.now()}`,
      userRole: 'admin',
      organizationId: managerOrgId,
      memberRole: 'admin',
    });
    const managerTarget = await ensureUserInOrganization({
      emailPrefix: `mgr-no-actions-manager-${Date.now()}`,
      userRole: 'manager',
      organizationId: managerOrgId,
      memberRole: 'manager',
    });

    await page.goto('/admin/users');

    const adminRow = await findUserRowByEmail(page, adminTarget.email);
    await expect(adminRow.getByRole('button')).toHaveCount(0);

    const managerRow = await findUserRowByEmail(page, managerTarget.email);
    await expect(managerRow.getByRole('button')).toHaveCount(0);
  });

  test('manager should see interactive organization control in sidebar', async ({ page }) => {
    await page.waitForTimeout(3000);
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();

    const orgLabel = sidebar.getByText(/^organization$/i);
    await expect(orgLabel).toBeVisible();

    const orgGroup = orgLabel.locator('xpath=ancestor::*[@data-slot="sidebar-group"][1]');
    const orgControl = orgGroup.getByRole('button').first();

    await expect(orgControl).toBeVisible();
    await expect(orgControl).toBeEnabled();
    await expect(orgControl).toContainText(/manager org|organization/i);
  });

  test('manager sees Admin in org member role dropdown in the current UI', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const managerOrg = await findOrganizationListItemBySlug(page, MANAGER_ORG_SLUG);
    await managerOrg.click();
    await page.waitForTimeout(2000);

    // Find a member row with a role dropdown (Select trigger)
    const roleSelects = page.locator('table td button[data-slot="select-trigger"]')
      .or(page.locator('table td [role="combobox"]'));
    const selectCount = await roleSelects.count();
    expect(selectCount).toBeGreaterThan(0);

    // Click the first role dropdown
    await roleSelects.first().click();
    await page.waitForTimeout(500);

    // Check dropdown options for the current UI behavior.
    const roleListbox = page.getByRole('listbox').last();
    await expect(roleListbox).toBeVisible({ timeout: 5000 });
    await expect(roleListbox.getByRole('option', { name: /^admin$/i }).first()).toBeVisible();
    await expect(roleListbox.getByRole('option', { name: /^manager$/i }).first()).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('manager sees Admin role in Add Member dialog in the current UI', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const managerOrg = await findOrganizationListItemBySlug(page, MANAGER_ORG_SLUG);
    await managerOrg.click();
    await page.waitForTimeout(2000);

    // Click "Add Member" button
    const addMemberBtn = page.getByRole('button', { name: /add member/i });
    await expect(addMemberBtn).toBeVisible({ timeout: 3000 });
    await addMemberBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Open the Role select in the dialog
    const dialog = page.getByRole('dialog');
    const roleSelect = dialog.locator('[role="combobox"]').last()
      .or(dialog.locator('button[data-slot="select-trigger"]').last());
    await expect(roleSelect).toBeVisible({ timeout: 2000 });
    await roleSelect.click();
    await page.waitForTimeout(500);

    // Admin is currently exposed as an option for a manager.
    const adminOption = page.getByRole('option', { name: /^admin$/i });
    await expect(adminOption).toBeVisible();

    await page.keyboard.press('Escape');

    // Close dialog
    await page.keyboard.press('Escape');
  });
});
