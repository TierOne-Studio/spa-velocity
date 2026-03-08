import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { DATABASE_URL, TEST_USER } from './env';
import { resendTestEmail } from '../src/shared/utils/resendTestEmail';

const AUX_ORG_SLUG = 'e2e-admin-org';
const AUX_MEMBER_EMAIL = resendTestEmail('delivered', 'e2e-admin-member');
const AUX_MANAGER_EMAIL = resendTestEmail('delivered', 'e2e-admin-manager');

/**
 * Admin Panel E2E Tests
 * 
 * These tests automatically set up the test user as admin before running.
 */

async function withDatabase<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function findOrganizationCardBySlug(page: import('@playwright/test').Page, slug: string) {
  const searchInput = page.getByPlaceholder(/search organizations/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(slug);
  await page.waitForTimeout(800);

  const targetOrg = page
    .locator('button')
    .filter({ hasText: new RegExp(`/${slug}\\b`, 'i') })
    .first();

  await expect(targetOrg).toBeVisible({ timeout: 15000 });
  return targetOrg;
}

async function ensureAdminFixtures(): Promise<void> {
  await withDatabase(async (pool) => {
    const adminResult = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [TEST_USER.email],
    );

    if (adminResult.rowCount === 0) {
      throw new Error(`Test admin user not found: ${TEST_USER.email}`);
    }

    const adminId = adminResult.rows[0].id;

    await pool.query(
      `UPDATE "user" SET role = 'admin', "emailVerified" = true WHERE id = $1`,
      [adminId],
    );

    await pool.query(
      `INSERT INTO organization (id, name, slug, "createdAt", metadata)
       VALUES (gen_random_uuid()::text, $1, $2, NOW(), NULL)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             "createdAt" = NOW()`,
      ['E2E Admin Organization', AUX_ORG_SLUG],
    );

    const orgResult = await pool.query<{ id: string }>(
      `SELECT id FROM organization WHERE slug = $1`,
      [AUX_ORG_SLUG],
    );

    if (orgResult.rowCount === 0) {
      throw new Error(`Failed to ensure organization fixture: ${AUX_ORG_SLUG}`);
    }

    const orgId = orgResult.rows[0].id;

    const ensureUser = async (email: string, role: 'manager' | 'member', name: string) => {
      const userResult = await pool.query<{ id: string }>(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE
           SET role = EXCLUDED.role,
               "emailVerified" = true,
               "updatedAt" = NOW()
         RETURNING id`,
        [name, email, role],
      );

      const userId = userResult.rows[0].id;

      await pool.query(
        `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [orgId, userId, role],
      );
    };

    await ensureUser(AUX_MEMBER_EMAIL, 'member', 'E2E Admin Member');
    await ensureUser(AUX_MANAGER_EMAIL, 'manager', 'E2E Admin Manager');

    await pool.query(`DELETE FROM session WHERE "userId" = $1`, [adminId]);
  });
}

// Helper to login
async function login(page: import('@playwright/test').Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

// Helper to check if Admin group is visible (groups are expanded by default)
async function isAdminGroupVisible(page: import('@playwright/test').Page) {
  // Groups are expanded by default, so just check if Users link is visible
  const usersLink = page.getByRole('link', { name: /^users$/i });
  return await usersLink.isVisible({ timeout: 3000 }).catch(() => false);
}

// Helper to login as admin and navigate to admin page
async function loginAsAdmin(page: import('@playwright/test').Page, adminPath: string) {
  await login(page);
  
  // Wait for sidebar to fully load
  await page.waitForTimeout(1000);
  
  // Check if Admin group is visible (groups are expanded by default)
  const hasAdminGroup = await isAdminGroupVisible(page);
  
  if (!hasAdminGroup) {
    // Debug: Check what links/buttons are visible
    const allLinks = await page.getByRole('link').allTextContents();
    console.log('Available links:', allLinks);
    
    // User is not admin - this test requires manual setup
    throw new Error(
      'Test user is not an admin. Available links: ' + allLinks.join(', ')
    );
  }
  
  await page.goto(adminPath);
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Panel E2E Tests', () => {
  test.beforeAll(async () => {
    await ensureAdminFixtures();
  });
  
  test.describe('Basic Access', () => {
    test('should login and access dashboard', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/');
      // Check sidebar has dashboard link
      await expect(page.locator('[data-slot="sidebar"]').getByRole('link', { name: /dashboard/i })).toBeVisible();
    });

    test('should show admin navigation for admin users', async ({ page }) => {
      await login(page);
      
      // Groups are expanded by default - verify admin navigation items are visible
      await expect(page.getByRole('link', { name: /^users$/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('link', { name: /sessions/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /organizations/i })).toBeVisible();
    });
  });

  test.describe('Users Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/users');
    });

    test('should display users list page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
      await expect(page.getByPlaceholder(/search users/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
    });

    test('should open create user dialog', async ({ page }) => {
      await page.getByRole('button', { name: /add user/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      // Use heading role to be specific about the dialog title
      await expect(page.getByRole('heading', { name: 'Create New User' })).toBeVisible();
    });

    test('should search users', async ({ page }) => {
      await page.getByPlaceholder(/search users/i).fill('test');
      await page.waitForTimeout(500);
      const table = page.locator('table');
      await expect(table).toBeVisible();
    });

    test('should show pagination', async ({ page }) => {
      await expect(page.getByText(/page \d+ of/i)).toBeVisible();
    });
  });

  test.describe('Sessions Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/sessions');
    });

    test('should display sessions page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /user sessions/i })).toBeVisible();
    });

    test('should show user list', async ({ page }) => {
      await expect(page.getByPlaceholder(/search users/i)).toBeVisible();
    });
  });

  test.describe('Organizations Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/organizations');
    });

    test('should display organizations page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Organization', exact: true })).toBeVisible();
    });

    test('should open create organization dialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Create Organization', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      // Use heading role to be specific about the dialog title
      await expect(page.getByRole('heading', { name: 'Create Organization' })).toBeVisible();
    });
  });

  test.describe('Organizations - Select Fixes', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/organizations');
    });

    test('should render OrganizationsPage without Select component errors', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: 'Create Organization', exact: true })).toBeVisible();

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.waitForTimeout(2000);

      const selectErrors = consoleErrors.filter(
        (e) => e.includes('Select') || e.includes('Radix') || e.includes('value prop'),
      );
      expect(selectErrors).toHaveLength(0);
    });

    test('should display member roles correctly in organization details', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const targetOrg = await findOrganizationCardBySlug(page, AUX_ORG_SLUG);

      await targetOrg.click();
      await page.waitForTimeout(1000);
      await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/users');
    });

    test('should navigate between admin pages', async ({ page }) => {
      await expect(page).toHaveURL('/admin/users');

      // Admin group should already be expanded since we're on an admin page
      await page.getByRole('link', { name: /sessions/i }).click();
      await expect(page).toHaveURL('/admin/sessions');

      await page.getByRole('link', { name: /organizations/i }).click();
      await expect(page).toHaveURL('/admin/organizations');

      // Dashboard is inside the Main group (expanded by default) - use sidebar link
      await page.locator('[data-slot="sidebar"]').getByRole('link', { name: /dashboard/i }).click();
      await expect(page).toHaveURL('/');
    });

    test('should show breadcrumbs for navigation', async ({ page }) => {
      // On users page, breadcrumb should show: Admin > Users (follows sidebar grouping)
      await expect(page.getByLabel('breadcrumb')).toBeVisible();
      await expect(page.getByLabel('breadcrumb').getByText('Admin')).toBeVisible();
      await expect(page.getByLabel('breadcrumb').getByText('Users')).toBeVisible();
    });

    test('should navigate via breadcrumb links', async ({ page }) => {
      // Click on Admin in breadcrumb to go to admin section root
      await page.getByLabel('breadcrumb').getByRole('link', { name: 'Admin' }).click();
      // Admin doesn't have a dedicated page, so it stays on current or goes to first admin page
      await expect(page.getByLabel('breadcrumb')).toBeVisible();
    });
  });

  test.describe('Edit User', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/users');
    });

    test('should open edit user dialog from dropdown menu', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Click on first user's action menu
      const actionButton = page.locator('table tbody tr').first().getByRole('button');
      await actionButton.click();
      
      // Click Edit User
      await page.getByRole('menuitem', { name: /edit user/i }).click();
      
      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible();
    });
  });

  test.describe('Bulk Delete Users', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/users');
    });

    test('should show checkboxes for row selection', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Check that checkboxes are visible in the table header and rows
      const headerCheckbox = page.locator('table thead th').first().getByRole('checkbox');
      await expect(headerCheckbox).toBeVisible();
      
      const rowCheckbox = page.locator('table tbody tr').first().getByRole('checkbox');
      await expect(rowCheckbox).toBeVisible();
    });

    test('should select individual users with checkboxes', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Click checkbox on first row
      const firstRowCheckbox = page.locator('table tbody tr').first().getByRole('checkbox');
      await firstRowCheckbox.click();
      
      // Verify selection count shows
      await expect(page.getByText(/1 of \d+ row\(s\) selected/i)).toBeVisible();
    });

    test('should select all users with header checkbox', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Click header checkbox to select all
      const headerCheckbox = page.locator('table thead th').first().getByRole('checkbox');
      await headerCheckbox.click();
      
      // Verify all rows are selected (selection count updates)
      await expect(page.getByText(/\d+ of \d+ row\(s\) selected/i)).toBeVisible();
    });

    test('should show bulk delete button when users are selected', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Initially, delete button should not be visible
      await expect(page.getByRole('button', { name: /delete \(\d+\)/i })).not.toBeVisible();
      
      // Select a user
      const firstRowCheckbox = page.locator('table tbody tr').first().getByRole('checkbox');
      await firstRowCheckbox.click();
      
      // Now delete button should appear
      await expect(page.getByRole('button', { name: /delete \(1\)/i })).toBeVisible();
    });

    test('should show confirmation dialog when clicking bulk delete', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Select a user
      const firstRowCheckbox = page.locator('table tbody tr').first().getByRole('checkbox');
      await firstRowCheckbox.click();
      
      // Click the delete button
      await page.getByRole('button', { name: /delete \(1\)/i }).click();
      
      // Verify confirmation dialog appears
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /delete 1 user/i })).toBeVisible();
      await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible();
    });

    test('should cancel bulk delete when clicking cancel', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Select a user
      const firstRowCheckbox = page.locator('table tbody tr').first().getByRole('checkbox');
      await firstRowCheckbox.click();
      
      // Click the delete button
      await page.getByRole('button', { name: /delete \(1\)/i }).click();
      
      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();
      
      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
      
      // Selection should still be there
      await expect(page.getByRole('button', { name: /delete \(1\)/i })).toBeVisible();
    });

    test('should update selection count when selecting multiple users', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      expect(rowCount).toBeGreaterThanOrEqual(2);

      // Select first user
      await rows.nth(0).getByRole('checkbox').click();
      await expect(page.getByRole('button', { name: /delete \(1\)/i })).toBeVisible();

      // Select second user
      await rows.nth(1).getByRole('checkbox').click();
      await expect(page.getByRole('button', { name: /delete \(2\)/i })).toBeVisible();
    });

    test('should deselect users when unchecking', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');
      
      // Select a user
      const firstRowCheckbox = page.locator('table tbody tr').first().getByRole('checkbox');
      await firstRowCheckbox.click();
      await expect(page.getByRole('button', { name: /delete \(1\)/i })).toBeVisible();
      
      // Deselect the user
      await firstRowCheckbox.click();
      
      // Delete button should disappear
      await expect(page.getByRole('button', { name: /delete \(\d+\)/i })).not.toBeVisible();
    });
  });

  test.describe('Edit Organization', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/organizations');
    });

    test('should show edit button for organizations', async ({ page }) => {
      // Wait for organizations to load
      await page.waitForTimeout(1000);
      
      const targetOrg = await findOrganizationCardBySlug(page, AUX_ORG_SLUG);

      // Open organization actions menu and verify Edit action is available
      const orgActionsButton = targetOrg.locator('button').first();
      await orgActionsButton.click();

      const editOption = page.getByRole('menuitem', { name: /edit/i });
      await expect(editOption).toBeVisible();
    });
  });

  test.describe('Slug Validation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/organizations');
    });

    test('should validate slug when creating organization', async ({ page }) => {
      await page.getByRole('button', { name: 'Create Organization', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Fill in name
      await page.getByLabel('Name').fill('Test Organization');
      
      // Fill in slug and wait for validation
      await page.getByLabel('Slug').fill('test-org');
      await page.waitForTimeout(1000);
      
      // Should show validation status (either available or taken)
      const slugInput = page.getByLabel('Slug');
      await expect(slugInput).toBeVisible();
    });
  });

  test.describe('Roles & Permissions', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, '/admin/roles');
    });

    test('should display roles page shell', async ({ page }) => {
      // RBAC visibility and role-card matrix assertions are covered by rbac-*-matrix specs.
      await expect(page).toHaveURL('/admin/roles');
      await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();
    });

    test('should open create role dialog', async ({ page }) => {
      await page.getByRole('button', { name: /create role/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/create new role/i)).toBeVisible();
      // Check for form fields using more specific selectors
      await expect(page.getByRole('textbox', { name: /name \(identifier\)/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /display name/i })).toBeVisible();
    });

    test('should allow changing user role from users page', async ({ page }) => {
      // Navigate to users page
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/search users/i);
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill(AUX_MEMBER_EMAIL);
      await page.waitForTimeout(800);
      
      // Wait for deterministic fixture row and open actions
      const targetRow = page.locator('table tbody tr', { hasText: AUX_MEMBER_EMAIL }).first();
      await expect(targetRow).toBeVisible({ timeout: 15000 });

      const actionButton = targetRow.getByRole('button');
      await actionButton.click();
      await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    test('should persist permissions when assigned to a role', async ({ page }) => {
      // Wait for roles to load
      await page.waitForSelector('[data-testid^="role-card-"]');
      
      // Find the admin role card and click Manage permissions
      const adminCard = page.locator('[data-testid="role-card-admin"]');
      await adminCard.getByRole('button', { name: /manage/i }).click();
      
      // Wait for permissions dialog to open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/manage permissions/i)).toBeVisible();
      
      // Wait for permissions to load in the dialog
      await page.waitForTimeout(500);
      
      // Check if there are any checkboxes (permissions loaded)
      const checkboxes = page.getByRole('checkbox');
      const checkboxCount = await checkboxes.count();

      expect(checkboxCount).toBeGreaterThan(0);

      // Get the first checkbox state
      const firstCheckbox = checkboxes.first();
      const wasChecked = await firstCheckbox.isChecked();

      // Toggle it
      await firstCheckbox.click();

      // Save permissions
      await page.getByRole('button', { name: /save permissions/i }).click();

      // Wait for dialog to close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

      // Re-open the permissions dialog
      await adminCard.getByRole('button', { name: /manage/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(500);

      const reloadedCheckbox = page.getByRole('checkbox').first();

      // Verify the permission state was persisted
      const newState = await reloadedCheckbox.isChecked();
      expect(newState).toBe(!wasChecked);

      // Restore original state
      await reloadedCheckbox.click();
      await page.getByRole('button', { name: /save permissions/i }).click();
    });
  });
});
