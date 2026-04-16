import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import {
  ensureTestUserExists,
  escapeRegExp,
  ensureUserRecord,
  loginWithCredentials,
  withDatabase,
} from '../test-helpers';
import { resendTestEmail } from '../../src/shared/utils/resendTestEmail';

// Use stable emails so users persist across runs and can be found by name search
const noSessionUserEmail = resendTestEmail('delivered', 'e2e-session-empty-stable');
const activeSessionUserEmail = resendTestEmail('delivered', 'e2e-session-active-stable');

// Sessions page searches by name (searchField: "name"), not email
const noSessionSearchTerm = 'E2E No Sessions User';
const activeSessionSearchTerm = 'E2E Active Sessions User';

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
}

async function openSessionsPage(page: Page) {
  await page.goto('/admin/sessions');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /user sessions/i })).toBeVisible();
}

async function selectUser(page: Page, params: { searchTerm: string; expectedText: string }) {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await expect(searchInput).toBeEnabled({ timeout: 5000 });
  await searchInput.fill(params.searchTerm);
  // Wait for the search results to update (React Query debounce + network)
  await page.waitForTimeout(1500);

  const buttonsInList = page.locator('main button');
  const byExpectedText = buttonsInList.filter({
    hasText: new RegExp(escapeRegExp(params.expectedText), 'i'),
  });

  await expect(byExpectedText.first()).toBeVisible({ timeout: 15000 });
  await byExpectedText.first().click();
}

test.describe('Sessions edge behavior', () => {
  test.beforeAll(async () => {
    // Restore test user to admin in case a previous spec left it in another role
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });

    // Use direct DB insert to guarantee users exist with correct names
    const userWithoutSessions = await ensureUserRecord({
      email: noSessionUserEmail,
      name: 'E2E No Sessions User',
      role: 'member',
    });

    const activeUser = await ensureUserRecord({
      email: activeSessionUserEmail,
      name: 'E2E Active Sessions User',
      role: 'member',
    });

    await withDatabase(async (pool) => {
      // Ensure no sessions for the no-session user
      await pool.query('DELETE FROM session WHERE "userId" = $1', [userWithoutSessions.id]);
      // Create a synthetic session for the active user so sessions page shows rows
      await pool.query(
        `INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent")
         VALUES (gen_random_uuid()::text, $1, gen_random_uuid()::text, NOW() + INTERVAL '1 day', NOW(), NOW(), '127.0.0.1', 'E2E Test Browser')
         ON CONFLICT DO NOTHING`,
        [activeUser.id],
      );
    });
  });

  test('should show no-user-selected state before choosing a user', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);

    await expect(page.getByText(/select a user from the list to view their sessions/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /revoke all/i })).not.toBeVisible();
  });

  test('should show no active sessions state for user without sessions', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, {
      searchTerm: noSessionSearchTerm,
      expectedText: noSessionSearchTerm,
    });

    await expect(page.getByText(/no active sessions found for this user/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /revoke all/i })).toBeDisabled();
  });

  test('cancel revoke-all should keep the same session rows', async ({ page }) => {
    await loginAsAdmin(page);
    await openSessionsPage(page);
    await selectUser(page, {
      searchTerm: activeSessionSearchTerm,
      expectedText: activeSessionSearchTerm,
    });

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    const beforeCount = await rows.count();

    await page.getByRole('button', { name: /revoke all/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /cancel/i }).click();

    await expect(dialog).not.toBeVisible();
    const afterCount = await page.locator('table tbody tr').count();
    expect(afterCount).toBe(beforeCount);
  });
});
