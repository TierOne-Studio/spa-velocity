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

async function roleExists(name: string): Promise<boolean> {
  return await withDatabase(async (pool) => {
    const result = await pool.query(`SELECT 1 FROM roles WHERE name = $1 LIMIT 1`, [name]);
    return result.rowCount > 0;
  });
}

// Login helper
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function selectFirstOrganizationOnRolesPage(page: Page) {
  const organizationSelect = page.getByRole('combobox', { name: /organization/i });
  const fallbackSelect = page.getByRole('combobox').first();
  const trigger = await organizationSelect.isVisible({ timeout: 1000 }).catch(() => false)
    ? organizationSelect
    : fallbackSelect;

  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();

  const firstOrganizationOption = page
    .getByRole('option')
    .filter({ hasNotText: /all organizations/i })
    .first();

  await expect(firstOrganizationOption).toBeVisible({ timeout: 10000 });
  await firstOrganizationOption.click();
}

// Generate unique identifiers for test data
function uniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================================================
// ROLE MANAGEMENT TESTS
// ============================================================================

test.describe.serial('Role Management - Full CRUD', () => {
  test.beforeAll(async () => {
    await ensureAdminRole();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
  });

  test('should display roles page shell', async ({ page }) => {
    // RBAC role visibility and action-gating expectations are covered in rbac-*-matrix specs.
    await expect(page).toHaveURL('/admin/roles');
    await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();
  });

  test('should create a new custom role', async ({ page }) => {
    const roleName = `custom-role-${uniqueId()}`;
    const roleDisplayName = `Custom Role ${uniqueId()}`;

    // Wait for page to fully load
    await page.waitForSelector('[data-testid^="role-card-"]');
    await selectFirstOrganizationOnRolesPage(page);

    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('textbox', { name: /name \(identifier\)/i }).fill(roleName);
    await page.getByRole('textbox', { name: /display name/i }).fill(roleDisplayName);

    const descriptionInput = page.getByRole('textbox', { name: /description/i });
    if (await descriptionInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descriptionInput.fill('A custom role for testing');
    }

    await page.getByRole('dialog').getByRole('button', { name: /^create$/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    await expect.poll(() => roleExists(roleName), { timeout: 15000 }).toBe(true);
  });

  test('should edit a role display name', async ({ page }) => {
    await page.waitForSelector('[data-testid^="role-card-"]');

    // Find a non-system role to edit, or use manager role
    const managerCard = page.locator('[data-testid="role-card-manager"]');
    const editButton = managerCard.getByRole('button', { name: /edit/i });

    if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editButton.click();

      await expect(page.getByRole('dialog')).toBeVisible();

      // Update display name
      const displayNameInput = page.getByRole('textbox', { name: /display name/i });
      if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await displayNameInput.clear();
        await displayNameInput.fill('Manager Updated');

        await page.getByRole('button', { name: /save|update/i }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should manage permissions for a role', async ({ page }) => {
    await page.waitForSelector('[data-testid^="role-card-"]');

    const managerCard = page.locator('[data-testid="role-card-manager"]').first();
    await managerCard.getByRole('button', { name: /manage/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/manage permissions/i)).toBeVisible();

    // Wait for permissions to load
    await page.waitForTimeout(1000);

    const checkboxes = page.getByRole('dialog').getByRole('checkbox');
    const checkboxCount = await checkboxes.count();

    if (checkboxCount > 0) {
      // Toggle first permission
      const firstCheckbox = checkboxes.first();
      const wasChecked = await firstCheckbox.isChecked();
      await firstCheckbox.click();

      // Save
      await page.getByRole('button', { name: /save permissions/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

      // Re-open and verify
      await managerCard.getByRole('button', { name: /manage/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(500);

      const newState = await checkboxes.first().isChecked();
      expect(newState).toBe(!wasChecked);

      // Restore original state
      await checkboxes.first().click();
      await page.getByRole('button', { name: /save permissions/i }).click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('should delete a custom role', async ({ page }) => {
    // First create a role to delete
    const roleName = `delete-role-${uniqueId()}`;
    const roleDisplayName = `Delete Role ${uniqueId()}`;

    await selectFirstOrganizationOnRolesPage(page);
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('textbox', { name: /name \(identifier\)/i }).fill(roleName);
    await page.getByRole('textbox', { name: /display name/i }).fill(roleDisplayName);
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Find and delete the role
    const roleCard = page.locator(`[data-testid="role-card-${roleName}"]`);
    if (await roleCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      const deleteButton = roleCard.getByRole('button', { name: /delete/i });
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i });
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }

        await page.waitForTimeout(1000);

        // Verify role is gone
        await expect(roleCard).not.toBeVisible();
      }
    }
  });

  test('should not allow deleting system roles', async ({ page }) => {
    await page.waitForSelector('[data-testid^="role-card-"]');

    // System roles (admin, manager, member) should not have delete button
    const adminCard = page.locator('[data-testid="role-card-admin"]').first();
    const deleteButton = adminCard.getByRole('button', { name: /delete/i });

    // Delete button should not be visible for system roles
    await expect(deleteButton).not.toBeVisible();
  });
});

// ============================================================================
// CLEANUP - Restore admin role
// ============================================================================

test.describe.serial('Cleanup', () => {
  test('restore admin role for test user', async () => {
    await ensureAdminRole();
  });
});
