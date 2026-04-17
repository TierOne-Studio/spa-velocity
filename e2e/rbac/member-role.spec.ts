import { test, expect } from '@playwright/test';
import {
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganizationForUserSessions,
} from '../rbac-role-helpers';

test.describe.serial('Member Role - Basic Read Access', () => {
  let memberOrgId: string;

  test.beforeAll(async () => {
    await setUserRole('member');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'member-org',
      orgName: 'Member Org',
      memberRole: 'member',
    });
    memberOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(memberOrgId);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should login successfully and see dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/);
    // Verify sidebar is visible (dashboard link depends on dashboard:view permission)
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible({ timeout: 10000 });
  });

  test('should see read-only admin navigation items in sidebar', async ({ page }) => {
    await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /^organizations$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^users$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^roles/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^sessions$/i })).toHaveCount(0);
  });

  test('should access /admin/organizations directly but be blocked from /admin/users', async ({ page }) => {
    await page.goto('/admin/organizations');
    await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/);
  });
});
