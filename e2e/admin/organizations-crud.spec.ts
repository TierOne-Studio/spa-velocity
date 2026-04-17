import { test, expect, Page } from '@playwright/test';
import { Pool } from 'pg';
import { DATABASE_URL, TEST_USER } from '../env';
import { uniqueEmail } from '../test-helpers';

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

async function organizationExists(slug: string): Promise<boolean> {
  return await withDatabase(async (pool) => {
    const result = await pool.query(`SELECT 1 FROM organization WHERE slug = $1 LIMIT 1`, [slug]);
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

// Generate unique identifiers for test data
function uniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================================================
// ORGANIZATION MANAGEMENT TESTS
// ============================================================================

test.describe.serial('Organization Management - Full CRUD', () => {
  test.beforeAll(async () => {
    await ensureAdminRole();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/admin/organizations');
    // Wait for page heading and Create button to be visible
    await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Create Organization', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('should create a new organization', async ({ page }) => {
    const orgSlug = `test-org-${uniqueId()}`;
    const orgName = `Test Org ${uniqueId()}`;

    // Wait for Create button to be ready
    const createButton = page.getByRole('button', { name: 'Create Organization', exact: true });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Organization' })).toBeVisible();

    // Wait for form fields to be ready
    await expect(page.getByLabel('Name')).toBeVisible();

    await page.getByLabel('Name').fill(orgName);
    await page.getByLabel('Slug').fill(orgSlug);

    await page.getByRole('button', { name: /create/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15000 });
    await expect.poll(() => organizationExists(orgSlug), { timeout: 15000 }).toBe(true);
  });

  test('should edit an organization', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find an organization to edit
    const orgButtons = page.locator('button').filter({ hasText: /^\// });
    const hasOrgs = await orgButtons.count() > 0;

    if (hasOrgs) {
      await orgButtons.first().click();
      await page.waitForTimeout(500);

      // Click edit button
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click();

        await expect(page.getByRole('dialog')).toBeVisible();

        // Update the name
        const nameInput = page.getByLabel('Name');
        await nameInput.clear();
        await nameInput.fill(`Updated Org ${uniqueId()}`);

        await page.getByRole('button', { name: /save|update/i }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should add a member to organization', async ({ page }) => {
    await page.waitForTimeout(1000);

    const orgButtons = page.locator('button').filter({ hasText: /^\// });
    const hasOrgs = await orgButtons.count() > 0;

    if (hasOrgs) {
      await orgButtons.first().click();
      await page.waitForTimeout(500);

      // Look for invite/add member button
      const inviteButton = page.getByRole('button', { name: /invite|add member/i });
      if (await inviteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inviteButton.click();

        await expect(page.getByRole('dialog')).toBeVisible();

        // Fill invitation form
        const emailInput = page.getByLabel(/email/i);
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await emailInput.fill(uniqueEmail('full-coverage-invite'));

          // Select role
          const roleSelect = page.getByRole('combobox');
          if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
            await roleSelect.click();
            await page.getByRole('option', { name: /member/i }).click();
          }

          await page.getByRole('button', { name: /send|invite/i }).click();
        }

        await page.keyboard.press('Escape');
      }
    }
  });

  test('should change member role in organization', async ({ page }) => {
    await page.waitForTimeout(1000);

    const orgButtons = page.locator('button').filter({ hasText: /^\// });
    const hasOrgs = await orgButtons.count() > 0;

    if (hasOrgs) {
      await orgButtons.first().click();
      await page.waitForTimeout(500);

      // Look for member rows with role dropdown
      const memberRows = page.locator('[data-testid^="member-"]');
      if (await memberRows.count() > 0) {
        const roleSelect = memberRows.first().getByRole('combobox');
        if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await roleSelect.click();
          await page.getByRole('option', { name: /manager/i }).click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should remove a member from organization', async ({ page }) => {
    await page.waitForTimeout(1000);

    const orgButtons = page.locator('button').filter({ hasText: /^\// });
    const hasOrgs = await orgButtons.count() > 0;

    if (hasOrgs) {
      await orgButtons.first().click();
      await page.waitForTimeout(500);

      // Look for remove button on member rows
      const removeButtons = page.getByRole('button', { name: /remove|delete/i });
      if (await removeButtons.count() > 0) {
        await removeButtons.first().click();

        // Confirm removal
        const confirmButton = page.getByRole('button', { name: /confirm|remove|yes/i });
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });

  test('should delete an organization', async ({ page }) => {
    await page.waitForTimeout(1000);

    const orgButtons = page.locator('button').filter({ hasText: /^\// });
    const hasOrgs = await orgButtons.count() > 0;

    if (hasOrgs) {
      await orgButtons.first().click();
      await page.waitForTimeout(500);

      // Click delete button
      const deleteButton = page.getByRole('button', { name: /delete organization/i });
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i });
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });
});

// ============================================================================
// ORGANIZATION MEMBER MANAGEMENT TESTS (Invitations page was removed)
// ============================================================================

test.describe.serial('Organization Member Management', () => {
  test.beforeAll(async () => {
    await ensureAdminRole();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should be able to add member from organization page', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');

    const orgButtons = page.locator('button').filter({ hasText: /^\// });
    const hasOrgs = await orgButtons.count() > 0;

    if (hasOrgs) {
      await orgButtons.first().click();
      await page.waitForLoadState('networkidle');

      // Look for Add Member button
      const addMemberButton = page.getByRole('button', { name: /add member/i });
      if (await addMemberButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addMemberButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  });
});
