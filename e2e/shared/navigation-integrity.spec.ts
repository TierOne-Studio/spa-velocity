import { test, expect } from '@playwright/test';

import { TEST_USER } from '../env';
import { ensureTestUserExists, escapeRegExp, loginWithCredentials } from '../test-helpers';

test.describe('Navigation integrity', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });
  });

  test.beforeEach(async ({ page }) => {
    await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  });

  test('settings menu entry should not break navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Ensure sidebar is expanded
    const sidebar = page.locator('[data-slot="sidebar"]');
    if (!(await sidebar.isVisible().catch(() => false))) {
      const sidebarTrigger = page.getByRole('button', { name: /toggle sidebar/i });
      if (await sidebarTrigger.isVisible().catch(() => false)) {
        await sidebarTrigger.click();
        await page.waitForTimeout(500);
      }
    }

    const userMenuButton = sidebar
      .getByRole('button', { name: new RegExp(escapeRegExp(TEST_USER.email), 'i') });
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
    await userMenuButton.click();
    await page.waitForTimeout(500);

    const settingsItem = page.getByRole('menuitem', { name: /^settings$/i });
    // If menu didn't open on first click, try again
    if (!(await settingsItem.isVisible().catch(() => false))) {
      await userMenuButton.click();
      await page.waitForTimeout(500);
    }
    await expect(settingsItem).toBeVisible({ timeout: 10000 });
    await settingsItem.click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('admin users page should show breadcrumb chain Admin > Users', async ({ page }) => {
    await page.goto('/admin/users');

    const breadcrumb = page.getByLabel('breadcrumb');
    await expect(breadcrumb.getByRole('link', { name: /^admin$/i })).toBeVisible();
    await expect(breadcrumb.getByText('Users')).toBeVisible();
  });
});
