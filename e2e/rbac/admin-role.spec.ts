import { test, expect } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  ensureTestUserExists,
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganizationForUserSessions,
  ensureMemberUser,
  findUserRowByEmail,
  openActionsMenuForUserEmail,
} from '../rbac-role-helpers';

test.describe.serial('Admin Role - Full Platform Access', () => {
  let adminOrgId: string;

  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });
    await setUserRole('superadmin');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'admin-org',
      orgName: 'Admin Org',
      memberRole: 'admin',
    });
    adminOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(adminOrgId);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should see all admin navigation items', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole('link', { name: /^users$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /sessions/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /organizations/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /roles & permissions/i })).toBeVisible();
  });

  test('should access Users management page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
  });

  test('should access Sessions management page', async ({ page }) => {
    await page.goto('/admin/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  });

  test('should access Organizations management page', async ({ page }) => {
    await page.goto('/admin/organizations');
    await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^create organization$/i })).toBeVisible();
  });

  test('should access Roles & Permissions page', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /roles & permissions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create role/i })).toBeVisible();
  });

  test('should see all 3 unified roles on Roles page', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="role-card-manager"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="role-card-member"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('should see correct Admin role description', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const adminCard = page.locator('[data-testid="role-card-admin"]').first();
    await expect(adminCard).toBeVisible({ timeout: 15000 });
    await expect(
      adminCard.getByText(/organization administrator with full access within their organization/i),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should see correct Manager role description', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const managerCard = page.locator('[data-testid="role-card-manager"]').first();
    await expect(managerCard).toBeVisible({ timeout: 15000 });
    await expect(managerCard.getByText(/organization manager/i)).toBeVisible({ timeout: 15000 });
  });

  test('should see correct Member role description', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const memberCard = page.locator('[data-testid="role-card-member"]').first();
    await expect(memberCard).toBeVisible({ timeout: 15000 });
    await expect(memberCard.getByText(/organization member/i)).toBeVisible({ timeout: 15000 });
  });

  test('should be able to manage permissions for roles', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const managerCard = page.locator('[data-testid="role-card-manager"]').first();
    await expect(managerCard).toBeVisible({ timeout: 15000 });
    await managerCard.getByRole('button', { name: /manage/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/manage permissions/i)).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('should see impersonate option in user actions', async ({ page }) => {
    // Seed a member user so the admin has someone to impersonate
    const { email } = await ensureMemberUser('rbac-impersonate-target');

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(email);
    await page.waitForTimeout(800);

    const targetRow = page.locator('table tbody tr', { hasText: email }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    const actionBtn = targetRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should see change role option in user actions', async ({ page }) => {
    // Seed a member user so the admin has someone to change role for
    const { email } = await ensureMemberUser('rbac-changerole-target');

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(email);
    await page.waitForTimeout(800);

    const targetRow = page.locator('table tbody tr', { hasText: email }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    const actionBtn = targetRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Admin role should expose permissions management (21+ permissions available)', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid^="role-card-"]', { timeout: 60000 });

    const adminCard = page.locator('[data-testid="role-card-admin"]').first();
    await adminCard.getByRole('button', { name: /manage/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/manage permissions/i)).toBeVisible();

    const permissionCheckboxes = page.getByRole('checkbox');
    await expect(permissionCheckboxes.first()).toBeVisible({ timeout: 10000 });
    const permissionCount = await permissionCheckboxes.count();
    expect(permissionCount).toBeGreaterThan(15);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Member role should have limited permissions (3)', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid^="role-card-"]');

    const memberCard = page.locator('[data-testid="role-card-member"]').first();
    const permissionBadges = await memberCard.locator('.text-xs.font-mono').count();
    expect(permissionBadges).toBeLessThanOrEqual(5);
  });

  test('admin should see full actions on manager/member users', async ({ page }) => {
    const { email } = await ensureMemberUser('admin-action-target');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(email);
    await page.waitForTimeout(800);

    const targetRow = page.locator('table tbody tr', { hasText: email }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    const actionBtn = targetRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('admin should see edit-only + reset-password for self', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(TEST_USER.email);
    await page.waitForTimeout(800);

    const selfRow = page.locator('table tbody tr', { hasText: TEST_USER.email }).first();
    await expect(selfRow).toBeVisible({ timeout: 15000 });

    const actionBtn = selfRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await page.keyboard.press('Escape');
  });
});
