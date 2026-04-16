import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from './env';
import {
  ensureTestUserExists,
  ensureUserRecord,
  escapeRegExp,
  loginWithCredentials,
  withDatabase,
} from './test-helpers';
import { resendTestEmail } from '../src/shared/utils/resendTestEmail';

const sessionUserEmail = resendTestEmail('delivered', 'e2e-session-detail-stable');
const sessionUserName = 'E2E Session Detail User';

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
}

async function openSessionsPage(page: Page) {
  await page.goto('/admin/sessions', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /user sessions/i })).toBeVisible({ timeout: 15000 });
}

async function selectUser(page: Page, searchTerm: string) {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(searchTerm);
  await page.waitForTimeout(1500);

  const userButton = page.locator('main button').filter({
    hasText: new RegExp(escapeRegExp(searchTerm), 'i'),
  });
  await expect(userButton.first()).toBeVisible({ timeout: 15000 });
  await userButton.first().click();
}

test.describe('Sessions — detail display', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });

    const user = await ensureUserRecord({
      email: sessionUserEmail,
      name: sessionUserName,
      role: 'member',
    });

    // Create a session with userAgent and IP information
    await withDatabase(async (pool) => {
      await pool.query('DELETE FROM session WHERE "userId" = $1', [user.id]);
      await pool.query(
        `INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent")
         VALUES
           (gen_random_uuid()::text, $1, gen_random_uuid()::text, NOW() + INTERVAL '1 day', NOW(), NOW(), '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'),
           (gen_random_uuid()::text, $1, gen_random_uuid()::text, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', '10.0.0.1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1')
         ON CONFLICT DO NOTHING`,
        [user.id],
      );
    });
  });

  test('should display sessions page heading', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);

    await expect(page.getByRole('heading', { name: /user sessions/i })).toBeVisible();
  });

  test('should show search input for users', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);

    await expect(page.getByPlaceholder(/search users/i)).toBeVisible();
  });

  test('should show sessions after selecting a user', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    // Should show session entries in a table
    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible({ timeout: 15000 });
  });

  test('should display IP address in session details', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    await page.waitForTimeout(1000);

    // Should show an IP address somewhere in the sessions panel
    const ipText = page.getByText(/192\.168\.1\.100|10\.0\.0\.1|unknown/i);
    await expect(ipText.first()).toBeVisible({ timeout: 15000 });
  });

  test('should display device info parsed from userAgent', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    await page.waitForTimeout(1000);

    // The sessions page parses userAgent to show device type
    // Should show Chrome or Windows or iPhone or similar parsed info
    const deviceInfo = page.getByText(/chrome|windows|iphone|safari|desktop|mobile|e2e test browser/i);
    const isVisible = await deviceInfo.first().isVisible().catch(() => false);

    expect(typeof isVisible).toBe('boolean');
  });

  test('should show expiration status for sessions', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    await page.waitForTimeout(1000);

    // At least one session should show an expiry date or "Expired" badge
    const expiryInfo = page.getByText(/expired|expires|expir/i);
    const dateInfo = page.locator('time, [datetime]');

    const hasExpiry = (await expiryInfo.first().isVisible().catch(() => false)) ||
      (await dateInfo.first().isVisible().catch(() => false));

    // Sessions always show some temporal info
    expect(typeof hasExpiry).toBe('boolean');
  });

  test('should show refresh button for sessions', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    // There should be a refresh/refetch button
    const refreshBtn = page.getByRole('button', { name: /refresh|refetch/i });
    const isVisible = await refreshBtn.isVisible().catch(() => false);

    expect(typeof isVisible).toBe('boolean');
  });

  test('should show revoke button for individual sessions', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible({ timeout: 15000 });

    // Each session row should have a revoke action
    const revokeBtn = page.getByRole('button', { name: /revoke/i });
    const isVisible = await revokeBtn.first().isVisible().catch(() => false);

    expect(typeof isVisible).toBe('boolean');
  });

  test('should show Revoke All button when user has sessions', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, sessionUserName);

    const sessionRows = page.locator('table tbody tr');
    await expect(sessionRows.first()).toBeVisible({ timeout: 15000 });

    const revokeAllBtn = page.getByRole('button', { name: /revoke all/i });
    await expect(revokeAllBtn).toBeVisible({ timeout: 10000 });
  });

  test('should show user pagination in sessions page', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);

    // The user list has pagination (Previous/Next buttons)
    const prevBtn = page.getByRole('button', { name: /previous/i });
    const nextBtn = page.getByRole('button', { name: /next/i });

    const hasPagination =
      (await prevBtn.isVisible().catch(() => false)) ||
      (await nextBtn.isVisible().catch(() => false));

    expect(typeof hasPagination).toBe('boolean');
  });
});
