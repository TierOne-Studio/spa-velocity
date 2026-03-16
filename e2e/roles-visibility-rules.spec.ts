import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
} from './test-helpers';

const PASSWORD = 'RolesVisibility123!';

const adminEmail = uniqueEmail('e2e-roles-admin');
const orgSlug = `e2e-roles-visibility-org-${Date.now()}`;

let organizationId = '';

async function openRolesPage(page: Page) {
  await page.goto('/admin/roles');
  await expect(page).toHaveURL('/admin/roles', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /roles & permissions/i })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible({ timeout: 15000 });
}

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, adminEmail, PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: adminEmail,
    organizationId,
  });
  await page.reload({ waitUntil: 'networkidle' });
}

test.describe('Roles page system-role invariants', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminEmail,
      password: PASSWORD,
      name: 'E2E Roles Admin',
      role: 'admin',
    });

    organizationId = await ensureOrganizationMembership({
      userEmail: adminEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E Roles Visibility Org',
    });
  });

  test('system roles should render system badge and block edit/delete actions', async ({ page }) => {
    await loginAsAdmin(page);
    await openRolesPage(page);

    for (const roleName of ['admin', 'manager', 'member']) {
      const roleCard = page.locator(`[data-testid="role-card-${roleName}"]`).first();
      await expect(roleCard).toBeVisible();
      await expect(roleCard.getByText(/^system$/i)).toBeVisible();
      await expect(roleCard.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
      await expect(roleCard.locator('button.text-destructive')).toHaveCount(0);
    }
  });
});
