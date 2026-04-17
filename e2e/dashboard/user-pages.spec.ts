import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import { ensureTestUserExists, loginWithCredentials } from '../test-helpers';

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
}

test.describe('User-facing pages', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });
  });

  test.describe('Legacy dashboard route', () => {
    test('should redirect /dashboard to chat for authenticated users', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/chat(\/.*)?$/);
      await expect(page.getByText(/^chats$/i)).toBeVisible({ timeout: 10000 });
    });

    test('should render chat content after redirecting from /dashboard', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main[data-slot="sidebar-inset"]');
      await expect(mainContent).toBeVisible();
      await expect(page).toHaveURL(/\/chat(\/.*)?$/);
    });
  });

  test.describe('Account page', () => {
    test('should display account heading', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /^account$/i })).toBeVisible();
      await expect(page.getByText(/manage your account details/i)).toBeVisible();
    });

    test('should display user name from auth context', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // The account page displays the user email in the main content area
      await expect(page.getByRole('main').getByText(TEST_USER.email)).toBeVisible({ timeout: 10000 });
    });

    test('should display coming soon message', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/account management features coming soon/i)).toBeVisible();
    });
  });

  test.describe('Settings page', () => {
    test('should display settings heading', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /^settings$/i }).first()).toBeVisible();
      await expect(page.getByText(/manage your application preferences/i)).toBeVisible();
    });

    test('should display under construction message', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/coming soon/i)).toBeVisible();
    });

    test('should display settings card with description', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/this page is under construction/i)).toBeVisible();
    });
  });
});
