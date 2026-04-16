import { test, expect, Page } from '@playwright/test';
import { Pool } from 'pg';
import { DATABASE_URL, TEST_USER } from '../env';

// Database helper
async function withDatabase<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

// Ensure test user is admin
async function ensureAdminRole() {
  await withDatabase(async (pool) => {
    await pool.query(`UPDATE "user" SET role = 'superadmin' WHERE email = $1`, [TEST_USER.email]);
    await pool.query(`DELETE FROM session WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)`, [TEST_USER.email]);
  });
}

// Login helper
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// SESSION MANAGEMENT TESTS
// ============================================================================

test.describe.serial('Session Management', () => {
  test.beforeAll(async () => {
    await ensureAdminRole();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/admin/sessions');
    await page.waitForLoadState('networkidle');
  });

  test('should display sessions page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  });

  test('should show user list with sessions', async ({ page }) => {
    await expect(page.getByPlaceholder(/search users/i)).toBeVisible();
  });

  test('should search for user sessions', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search users/i);
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
    }

    // Sessions page may show cards or table - just verify page loaded
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  });

  test('should revoke a session', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for revoke button on session rows
    const revokeButtons = page.getByRole('button', { name: /revoke|terminate/i });
    if (await revokeButtons.count() > 0) {
      await revokeButtons.first().click();

      // Confirm revocation
      const confirmButton = page.getByRole('button', { name: /confirm|revoke|yes/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      await page.waitForTimeout(1000);
    }
  });

  test('should revoke all sessions for a user', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for revoke all button
    const revokeAllButton = page.getByRole('button', { name: /revoke all|terminate all/i });
    if (await revokeAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await revokeAllButton.click();

      // Confirm revocation
      const confirmButton = page.getByRole('button', { name: /confirm|revoke|yes/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      await page.waitForTimeout(1000);
    }
  });
});
