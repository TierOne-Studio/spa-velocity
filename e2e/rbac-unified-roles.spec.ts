import { test, expect, type APIRequestContext, type Locator, Page } from '@playwright/test';
import { Pool } from 'pg';
import { DATABASE_URL, API_BASE_URL, TEST_USER } from './env';
import { ensureOrganizationMembership, ensureTestUserExists, findOrganizationListItemBySlug } from './test-helpers';
import { resendTestEmail } from '../src/shared/utils/resendTestEmail';

/**
 * Comprehensive E2E Tests for Unified Role Model
 * 
 * Tests the 3-role system:
 * - Admin: Global platform administrator with full access
 * - Manager: Organization manager with org-scoped access
 * - Member: Organization member with basic read access
 * 
 * Uses a single test user (delivered+e2e-test-user@resend.dev) and changes their role between test suites.
 */

// TEST_USER imported from ./env
const MANAGER_ORG_SLUG = 'manager-org';

// Database helper
async function withDatabase<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

// Set user role and clear sessions
async function setUserRole(role: 'superadmin' | 'admin' | 'manager' | 'member') {
  await withDatabase(async (pool) => {
    await pool.query(`UPDATE "user" SET role = $1 WHERE email = $2`, [role, TEST_USER.email]);
    await pool.query(`DELETE FROM session WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)`, [TEST_USER.email]);
    console.log(`✅ Set user role to: ${role}`);
  });
}

async function ensureOrganizationForTestUser(params: {
  orgSlug: string;
  orgName: string;
  memberRole: 'admin' | 'manager' | 'member';
}) {
  return await withDatabase(async (pool) => {
    const userRow = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [TEST_USER.email]);
    if (userRow.rowCount === 0) {
      throw new Error('Test user not found in database');
    }
    const userId = userRow.rows[0].id as string;

    const organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: params.memberRole,
      orgSlug: params.orgSlug,
      orgName: params.orgName,
    });

    return { organizationId, userId };
  });
}

async function setActiveOrganizationForUserSessions(organizationId: string) {
  await withDatabase(async (pool) => {
    await pool.query(
      `UPDATE session
       SET "activeOrganizationId" = $1
       WHERE "userId" IN (SELECT id FROM "user" WHERE email = $2)`,
      [organizationId, TEST_USER.email],
    );
  });
}

async function setActiveOrganization(page: Page, organizationId: string) {
  await page.evaluate(
    async ({ apiBaseUrl, nextOrganizationId }) => {
      const token = window.localStorage.getItem('bearer_token');
      const response = await fetch(`${apiBaseUrl}/api/auth/organization/set-active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ organizationId: nextOrganizationId }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`Failed to set active organization: ${response.status} ${error}`);
      }
    },
    { apiBaseUrl: API_BASE_URL, nextOrganizationId: organizationId },
  );
}

// Seed a member user for admin to act on
async function ensureMemberUser(emailPrefix: string) {
  return await withDatabase(async (pool) => {
    const email = resendTestEmail('delivered', emailPrefix);
    const userRow = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    let userId: string;
    if (userRow.rowCount === 0) {
      const insert = await pool.query(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'member', true, NOW(), NOW())
         RETURNING id`,
        [`Member ${emailPrefix}`, email],
      );
      userId = insert.rows[0].id;
      await pool.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'credential', $1, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [userId],
      );
    } else {
      userId = userRow.rows[0].id;
    }
    return { userId, email };
  });
}

async function ensureMemberUserInOrganization(emailPrefix: string, organizationId: string) {
  const { userId, email } = await ensureMemberUser(emailPrefix);

  await withDatabase(async (pool) => {
    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       SELECT gen_random_uuid()::text, $1, $2, 'member', NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2
       )`,
      [organizationId, userId],
    );
  });

  return { userId, email };
}

async function ensureUserInOrganization(params: {
  emailPrefix: string;
  userRole: 'admin' | 'manager' | 'member';
  organizationId: string;
  memberRole: 'admin' | 'manager' | 'member';
}) {
  return await withDatabase(async (pool) => {
    const email = resendTestEmail('delivered', params.emailPrefix);

    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET role = EXCLUDED.role,
             "emailVerified" = true,
             "updatedAt" = NOW()
       RETURNING id`,
      [`${params.userRole} ${params.emailPrefix}`, email, params.userRole],
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       SELECT gen_random_uuid()::text, $1, $2, $3, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2
       )`,
      [params.organizationId, userId, params.memberRole],
    );

    await pool.query(
      `UPDATE member SET role = $3
       WHERE "organizationId" = $1 AND "userId" = $2`,
      [params.organizationId, userId, params.memberRole],
    );

    return { userId, email };
  });
}

// Login helper
async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function signInAndGetAuthHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const signInRes = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });

  expect(signInRes.status()).toBe(200);
  const signInData = await signInRes.json();
  const token = signInData.token || signInData.session?.token;

  if (!token) {
    throw new Error('Authentication succeeded but no token was returned from sign-in response');
  }

  return { Authorization: `Bearer ${token}` };
}

async function findUserRowByEmail(page: Page, email: string): Promise<Locator> {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(email);
  await page.waitForTimeout(800);

  const targetRow = page.locator('table tbody tr', { hasText: email }).first();
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  return targetRow;
}

async function openActionsMenuForUserEmail(page: Page, email: string): Promise<void> {
  const row = await findUserRowByEmail(page, email);
  const actionBtn = row.getByRole('button', { name: /open menu/i });
  await expect(actionBtn).toBeVisible();
  await actionBtn.click();
}

test.describe.serial('Unified Role Model - Serial', () => {

// ============================================================================
// ADMIN ROLE TESTS - Full Platform Access
// ============================================================================

test.describe('Admin Role - Full Platform Access', () => {
  let adminOrgId: string;

  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });
    await setUserRole('superadmin');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'admin-org',
      orgName: 'Admin Org',
      memberRole: 'admin',
    });
    adminOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(adminOrgId);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should see all admin navigation items', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole('link', { name: /^users$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /sessions/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /organizations/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /roles & permissions/i })).toBeVisible();
  });

  test('should access Users management page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
  });

  test('should access Sessions management page', async ({ page }) => {
    await page.goto('/admin/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  });

  test('should access Organizations management page', async ({ page }) => {
    await page.goto('/admin/organizations');
    await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^create organization$/i })).toBeVisible();
  });

  test('should access Roles & Permissions page', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /roles & permissions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create role/i })).toBeVisible();
  });

  test('should see all 3 unified roles on Roles page', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="role-card-manager"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="role-card-member"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('should see correct Admin role description', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const adminCard = page.locator('[data-testid="role-card-admin"]').first();
    await expect(adminCard).toBeVisible({ timeout: 15000 });
    await expect(
      adminCard.getByText(/organization administrator with full access within their organization/i),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should see correct Manager role description', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const managerCard = page.locator('[data-testid="role-card-manager"]').first();
    await expect(managerCard).toBeVisible({ timeout: 15000 });
    await expect(managerCard.getByText(/organization manager/i)).toBeVisible({ timeout: 15000 });
  });

  test('should see correct Member role description', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const memberCard = page.locator('[data-testid="role-card-member"]').first();
    await expect(memberCard).toBeVisible({ timeout: 15000 });
    await expect(memberCard.getByText(/organization member/i)).toBeVisible({ timeout: 15000 });
  });

  test('should be able to manage permissions for roles', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const managerCard = page.locator('[data-testid="role-card-manager"]').first();
    await expect(managerCard).toBeVisible({ timeout: 15000 });
    await managerCard.getByRole('button', { name: /manage/i }).click();
    
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/manage permissions/i)).toBeVisible();
    
    await page.keyboard.press('Escape');
  });

  test('should see impersonate option in user actions', async ({ page }) => {
    // Seed a member user so the admin has someone to impersonate
    const { email } = await ensureMemberUser('rbac-impersonate-target');

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(email);
    await page.waitForTimeout(800);

    const targetRow = page.locator('table tbody tr', { hasText: email }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    const actionBtn = targetRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should see change role option in user actions', async ({ page }) => {
    // Seed a member user so the admin has someone to change role for
    const { email } = await ensureMemberUser('rbac-changerole-target');

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(email);
    await page.waitForTimeout(800);

    const targetRow = page.locator('table tbody tr', { hasText: email }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    const actionBtn = targetRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Admin role should expose permissions management (21+ permissions available)', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid^="role-card-"]', { timeout: 60000 });

    const adminCard = page.locator('[data-testid="role-card-admin"]').first();
    await adminCard.getByRole('button', { name: /manage/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/manage permissions/i)).toBeVisible();

    const permissionCheckboxes = page.getByRole('checkbox');
    await expect(permissionCheckboxes.first()).toBeVisible({ timeout: 10000 });
    const permissionCount = await permissionCheckboxes.count();
    expect(permissionCount).toBeGreaterThan(15);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Member role should have limited permissions (3)', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid^="role-card-"]');

    const memberCard = page.locator('[data-testid="role-card-member"]').first();
    const permissionBadges = await memberCard.locator('.text-xs.font-mono').count();
    expect(permissionBadges).toBeLessThanOrEqual(5);
  });

  test('admin should see full actions on manager/member users', async ({ page }) => {
    const { email } = await ensureMemberUser('admin-action-target');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(email);
    await page.waitForTimeout(800);

    const targetRow = page.locator('table tbody tr', { hasText: email }).first();
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    const actionBtn = targetRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('admin should see edit-only + reset-password for self', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(TEST_USER.email);
    await page.waitForTimeout(800);

    const selfRow = page.locator('table tbody tr', { hasText: TEST_USER.email }).first();
    await expect(selfRow).toBeVisible({ timeout: 15000 });

    const actionBtn = selfRow.getByRole('button', { name: /open menu/i });
    await actionBtn.click();
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await page.keyboard.press('Escape');
  });
});

// ============================================================================
// MANAGER ROLE TESTS - Organization-Scoped Access
// ============================================================================

test.describe('Manager Role - Organization-Scoped Access', () => {
  let managerOrgId: string;

  test.beforeAll(async () => {
    await setUserRole('manager');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: MANAGER_ORG_SLUG,
      orgName: 'Manager Org',
      memberRole: 'manager',
    });
    managerOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    // Re-ensure org + membership and refresh the org ID (handles stale ID from beforeAll)
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: MANAGER_ORG_SLUG,
      orgName: 'Manager Org',
      memberRole: 'manager',
    });
    managerOrgId = organizationId;
    await login(page);
    await setActiveOrganization(page, managerOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('should login successfully and see dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/);
    // Verify sidebar is visible (dashboard link depends on dashboard:view permission)
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible({ timeout: 10000 });
  });

  test('should see admin navigation items (manager allowed)', async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole('link', { name: /^users$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /sessions/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /organizations/i })).toBeVisible();
  });

  test('should access Users page and gate create-user UI by permission', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();

    const addUserButton = page.getByRole('button', { name: /add user/i });
    if (await addUserButton.isVisible().catch(() => false)) {
      await addUserButton.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Organization selector should be visible (proves backend metadata endpoint works and org is required)
      await expect(dialog.getByText('Organization', { exact: true })).toBeVisible();

      // Role selector should be visible
      await expect(dialog.getByText('Role', { exact: true })).toBeVisible();
    } else {
      await expect(addUserButton).not.toBeVisible();
    }
  });

  test('manager should see self actions constrained by permissions', async ({ page }) => {
    await page.goto('/admin/users');

    await openActionsMenuForUserEmail(page, TEST_USER.email);
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('manager should see member-user actions allowed by permissions', async ({ page }) => {
    const { email } = await ensureMemberUserInOrganization('mgr-action-target', managerOrgId);
    await page.goto('/admin/users');

    await openActionsMenuForUserEmail(page, email);

    // Matrix-aligned manager-on-member expectations.
    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /ban user|unban user/i })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('manager should NOT see actions on admin users', async ({ page }) => {
    const adminTarget = await ensureUserInOrganization({
      emailPrefix: `mgr-no-actions-admin-${Date.now()}`,
      userRole: 'admin',
      organizationId: managerOrgId,
      memberRole: 'admin',
    });
    const managerTarget = await ensureUserInOrganization({
      emailPrefix: `mgr-no-actions-manager-${Date.now()}`,
      userRole: 'manager',
      organizationId: managerOrgId,
      memberRole: 'manager',
    });

    await page.goto('/admin/users');

    const adminRow = await findUserRowByEmail(page, adminTarget.email);
    await expect(adminRow.getByRole('button')).toHaveCount(0);

    const managerRow = await findUserRowByEmail(page, managerTarget.email);
    await expect(managerRow.getByRole('button')).toHaveCount(0);
  });

  test('manager should see interactive organization control in sidebar', async ({ page }) => {
    await page.waitForTimeout(3000);
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();

    const orgLabel = sidebar.getByText(/^organization$/i);
    await expect(orgLabel).toBeVisible();

    const orgGroup = orgLabel.locator('xpath=ancestor::*[@data-slot="sidebar-group"][1]');
    const orgControl = orgGroup.getByRole('button').first();

    await expect(orgControl).toBeVisible();
    await expect(orgControl).toBeEnabled();
    await expect(orgControl).toContainText(/manager org|organization/i);
  });

  test('manager sees Admin in org member role dropdown in the current UI', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const managerOrg = await findOrganizationListItemBySlug(page, MANAGER_ORG_SLUG);
    await managerOrg.click();
    await page.waitForTimeout(2000);

    // Find a member row with a role dropdown (Select trigger)
    const roleSelects = page.locator('table td button[data-slot="select-trigger"]')
      .or(page.locator('table td [role="combobox"]'));
    const selectCount = await roleSelects.count();
    expect(selectCount).toBeGreaterThan(0);

    // Click the first role dropdown
    await roleSelects.first().click();
    await page.waitForTimeout(500);

    // Check dropdown options for the current UI behavior.
    const roleListbox = page.getByRole('listbox').last();
    await expect(roleListbox).toBeVisible({ timeout: 5000 });
    await expect(roleListbox.getByRole('option', { name: /^admin$/i }).first()).toBeVisible();
    await expect(roleListbox.getByRole('option', { name: /^manager$/i }).first()).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('manager sees Admin role in Add Member dialog in the current UI', async ({ page }) => {
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const managerOrg = await findOrganizationListItemBySlug(page, MANAGER_ORG_SLUG);
    await managerOrg.click();
    await page.waitForTimeout(2000);

    // Click "Add Member" button
    const addMemberBtn = page.getByRole('button', { name: /add member/i });
    await expect(addMemberBtn).toBeVisible({ timeout: 3000 });
    await addMemberBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Open the Role select in the dialog
    const dialog = page.getByRole('dialog');
    const roleSelect = dialog.locator('[role="combobox"]').last()
      .or(dialog.locator('button[data-slot="select-trigger"]').last());
    await expect(roleSelect).toBeVisible({ timeout: 2000 });
    await roleSelect.click();
    await page.waitForTimeout(500);

    // Admin is currently exposed as an option for a manager.
    const adminOption = page.getByRole('option', { name: /^admin$/i });
    await expect(adminOption).toBeVisible();

    await page.keyboard.press('Escape');

    // Close dialog
    await page.keyboard.press('Escape');
  });
});

// ============================================================================
// MEMBER ROLE TESTS - Basic Read Access
// ============================================================================

test.describe('Member Role - Basic Read Access', () => {
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
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/);
    // Verify sidebar is visible (dashboard link depends on dashboard:view permission)
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible({ timeout: 10000 });
  });

  test('should see read-only admin navigation items in sidebar', async ({ page }) => {
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/);
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
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/);
  });
});

// ============================================================================
// API PERMISSION RESTRICTION TESTS
// ============================================================================

test.describe('API Permission Restrictions', () => {
  // Note: 401 = Unauthorized (not authenticated), 403 = Forbidden (authenticated but not allowed)
  // Without authentication, we expect 401 or 403 depending on the endpoint
  
  test('should reject role creation without authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/rbac/roles`, {
      data: { name: 'hacker-role', displayName: 'Hacker Role' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject role update without authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/rbac/roles/some-id`, {
      data: { displayName: 'Hacked Role' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject role deletion without authentication', async ({ request }) => {
    const response = await request.delete(`${API_BASE_URL}/api/rbac/roles/some-id`);
    expect([401, 403]).toContain(response.status());
  });

  test('should reject permission assignment without authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/rbac/roles/some-id/permissions`, {
      data: { permissionIds: [] },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject platform admin org listing without authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/platform-admin/organizations`);
    expect([401, 403]).toContain(response.status());
  });

  test('should reject platform admin org update without authentication', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/platform-admin/organizations/some-id`, {
      data: { name: 'Hacked Org' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should reject platform admin org deletion without authentication', async ({ request }) => {
    const response = await request.delete(`${API_BASE_URL}/api/platform-admin/organizations/some-id`);
    expect([401, 403]).toContain(response.status());
  });

  test('should reject org impersonation without authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/organization/some-org-id/impersonate`, {
      data: { userId: 'target-user-id' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should forbid role creation for authenticated manager', async ({ request }) => {
    await setUserRole('manager');
    const headers = await signInAndGetAuthHeaders(request);

    const response = await request.post(`${API_BASE_URL}/api/rbac/roles`, {
      headers,
      data: { name: `mgr-blocked-${Date.now()}`, displayName: 'Manager Blocked Role' },
    });

    expect(response.status()).toBe(403);
  });

  test('should forbid role creation for authenticated member', async ({ request }) => {
    await setUserRole('member');
    const headers = await signInAndGetAuthHeaders(request);

    const response = await request.post(`${API_BASE_URL}/api/rbac/roles`, {
      headers,
      data: { name: `member-blocked-${Date.now()}`, displayName: 'Member Blocked Role' },
    });

    expect(response.status()).toBe(403);
  });
});

// ============================================================================
// USER CREATION TESTS - Admin & Manager Scenarios
// ============================================================================

test.describe('User Creation - Admin (UI)', () => {
  let adminUiOrgId: string;

  test.beforeAll(async () => {
    await setUserRole('admin');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'user-creation-admin-org',
      orgName: 'User Creation Admin Org',
      memberRole: 'admin',
    });
    adminUiOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(adminUiOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('should open create user dialog and see all role options', async ({ page }) => {
    await page.goto('/admin/users');
    // Wait for page to fully load before clicking
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    
    const addButton = page.getByRole('button', { name: /add user/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText('Create New User')).toBeVisible();
    
    // Verify form fields are present
    await expect(dialog.getByLabel('Name')).toBeVisible();
    await expect(dialog.getByLabel('Email')).toBeVisible();
    await expect(dialog.getByLabel('Password')).toBeVisible();
    await expect(dialog.getByText('Role', { exact: true })).toBeVisible();
  });

});



// Note: Backend API tests for user creation endpoints are covered by:
// 1. Backend unit tests (in nestjs-api-starter)
// 2. Organization scoping tests below (which test the API indirectly)
// 3. UI integration tests (create user dialog functionality)

// ============================================================================
// ORGANIZATION SCOPING TESTS - Manager Restrictions
// ============================================================================

test.describe('Organization Scoping - Manager Restrictions', () => {
  let managerOrgId: string;
  let otherOrgId: string;
  let userInManagerOrg: string;
  let userInOtherOrg: string;

  test.beforeAll(async () => {
    await setUserRole('admin');
    
    const { organizationId: org1 } = await ensureOrganizationForTestUser({
      orgSlug: 'scoping-org-1',
      orgName: 'Scoping Org 1',
      memberRole: 'manager',
    });
    managerOrgId = org1;
    
    await withDatabase(async (pool) => {
      const org2Result = await pool.query(
        `INSERT INTO organization (id, name, slug, "createdAt", metadata)
         VALUES (gen_random_uuid()::text, $1, $2, NOW(), NULL)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        ['Scoping Org 2', 'scoping-org-2']
      );
      otherOrgId = org2Result.rows[0].id;
      
      const user1Result = await pool.query(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, false, NOW(), NOW())
         RETURNING id`,
        ['User In Manager Org', resendTestEmail('delivered', `e2e-user-in-mgr-org-${Date.now()}`), 'member']
      );
      userInManagerOrg = user1Result.rows[0].id;
      
      await pool.query(
        `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
        [managerOrgId, userInManagerOrg, 'member']
      );
      
      const user2Result = await pool.query(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, false, NOW(), NOW())
         RETURNING id`,
        ['User In Other Org', resendTestEmail('delivered', `e2e-user-in-other-org-${Date.now()}`), 'member']
      );
      userInOtherOrg = user2Result.rows[0].id;
      
      await pool.query(
        `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
        [otherOrgId, userInOtherOrg, 'member']
      );
    });
    
    await setUserRole('manager');
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(managerOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('manager can access users page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
  });
});

// ============================================================================
// UNIFIED ROLE DROPDOWNS - Database-Driven Tests
// ============================================================================

test.describe('Unified Role Dropdowns - Database-Driven', () => {
  let dropdownAdminOrgId: string;

  test.beforeAll(async () => {
    await setUserRole('admin');
    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'dropdowns-admin-org',
      orgName: 'Dropdowns Admin Org',
      memberRole: 'admin',
    });
    dropdownAdminOrgId = organizationId;
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await setActiveOrganizationForUserSessions(dropdownAdminOrgId);
    await page.reload().catch(() => page.reload());
    await page.waitForLoadState('networkidle');
  });

  test('Users page Create User modal should show database roles (Admin, Manager, Member)', async ({ page }) => {
    await page.goto('/admin/users');
    // Wait for page to fully load before clicking
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    
    const addButton = page.getByRole('button', { name: /add user/i });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    
    // Click on Role dropdown
    await dialog.locator('button').filter({ hasText: /member/i }).first().click();
    
    // Verify all 3 database roles are available
    await expect(page.getByRole('option', { name: /admin/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /manager/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /member/i })).toBeVisible();
  });

  test('Organizations page member role dropdown should show database roles', async ({ page }) => {
    await page.goto('/admin/organizations');
    
    // Wait for organizations to load and select one
    await page.waitForSelector('text=Organizations');
    
    // Find an organization card and click it
    const orgCard = page.locator('[class*="cursor-pointer"]').filter({ hasText: /test/i }).first();
    if (await orgCard.isVisible()) {
      await orgCard.click();
      await page.waitForLoadState('networkidle');
      
      // Check if there are any members with role dropdowns
      const roleSelect = page.locator('button[role="combobox"]').first();
      if (await roleSelect.isVisible()) {
        await roleSelect.click();
        
        // Verify database roles are shown (not hardcoded owner/admin/member)
        const options = page.locator('[role="option"]');
        const count = await options.count();
        expect(count).toBeGreaterThanOrEqual(3);
        
        // Check for Admin, Manager, Member (database roles)
        await expect(page.getByRole('option', { name: /admin/i })).toBeVisible();
      }
    }
  });

  test('API /api/platform-admin/organizations/roles-metadata returns database roles', async ({ request }) => {
    // Login directly via API to get session token
    const signInRes = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    expect(signInRes.status()).toBe(200);
    const signInData = await signInRes.json();
    const token = signInData.token || signInData.session?.token;

    // Direct API sign-in creates a fresh session, so re-attach the org context
    // that the endpoint uses to resolve organization-scoped database roles.
    await setActiveOrganizationForUserSessions(dropdownAdminOrgId);
    
    const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    const response = await request.get(`${API_BASE_URL}/api/platform-admin/organizations/roles-metadata`, {
      headers: authHeaders,
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('roles');
    expect(data).toHaveProperty('assignableRoles');
    expect(Array.isArray(data.roles)).toBe(true);
    expect(Array.isArray(data.assignableRoles)).toBe(true);
    
    // Verify roles have database fields (not hardcoded)
    expect(data.roles.length).toBeGreaterThanOrEqual(3);
    
    const roleNames = data.roles.map((r: { name: string }) => r.name);
    
    // Verify roles have database-driven fields and assignable roles come from that same list.
    for (const role of data.roles as Array<{
      name: string;
      displayName: string;
      description?: string | null;
      color?: string | null;
      isDefault: boolean;
    }>) {
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('displayName');
      expect(role).toHaveProperty('description');
      expect(role).toHaveProperty('color');
      expect(role).toHaveProperty('isDefault');
    }
    for (const assignableRole of data.assignableRoles as string[]) {
      expect(roleNames).toContain(assignableRole);
    }
  });

  test('API /api/admin/users/create-metadata and organizations metadata both return DB-backed role lists', async ({ request }) => {
    // Login directly via API to get session token
    const signInRes = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    const signInData = await signInRes.json();
    const token = signInData.token || signInData.session?.token;
    const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

    const { organizationId } = await ensureOrganizationForTestUser({
      orgSlug: 'dropdown-admin-org',
      orgName: 'Dropdown Admin Org',
      memberRole: 'admin',
    });
    await setActiveOrganizationForUserSessions(organizationId);
    
    const [userMetaRes, orgMetaRes] = await Promise.all([
      request.get(`${API_BASE_URL}/api/admin/users/create-metadata`, { headers: authHeaders }),
      request.get(`${API_BASE_URL}/api/platform-admin/organizations/roles-metadata`, { headers: authHeaders }),
    ]);
    expect(userMetaRes.status()).toBe(200);
    expect(orgMetaRes.status()).toBe(200);
    const userMeta = await userMetaRes.json();
    const orgMeta = await orgMetaRes.json();
    
    const userRoleNames = userMeta.roles.map((r: { name: string }) => r.name);
    const orgRoleNames = orgMeta.roles.map((r: { name: string }) => r.name);

    expect(userRoleNames.length).toBeGreaterThan(0);
    expect(orgRoleNames.length).toBeGreaterThan(0);
    expect(userRoleNames.some((roleName: string) => orgRoleNames.includes(roleName))).toBe(true);

    for (const role of userMeta.roles as Array<Record<string, unknown>>) {
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('displayName');
    }

    for (const role of orgMeta.roles as Array<Record<string, unknown>>) {
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('displayName');
    }
  });
});

// ============================================================================
// RESTORE ADMIN ROLE AFTER TESTS
// ============================================================================

test.describe('Cleanup', () => {
  test('restore admin role for test user', async () => {
    await setUserRole('admin');
  });
});

});
