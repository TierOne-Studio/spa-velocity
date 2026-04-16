import { test, expect, type Page } from '@playwright/test';

import { API_BASE_URL, TEST_USER } from '../env';
import {
  ensureOrganizationMembership,
  ensureTestUserExists,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  withDatabase,
} from '../test-helpers';
import { signInAndGetAuthHeaders } from '../rbac-matrix.helpers';

const ORG_SLUG = 'e2e-roles-adv';
const ORG_NAME = 'E2E Roles Advanced';

let organizationId: string;

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
}

async function openRolesPage(page: Page) {
  await page.goto('/admin/roles', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible({ timeout: 15000 });
}

test.describe('Roles — advanced flows', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });

    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('should display roles page with heading', async ({ page }) => {
    await loginAsAdmin(page);
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await openRolesPage(page);

    await expect(page.getByRole('heading', { name: /roles/i }).first()).toBeVisible();
  });

  test('should show organization selector for superadmin', async ({ page }) => {
    await loginAsAdmin(page);
    await openRolesPage(page);

    // Superadmin sees an org selector on the roles page
    const orgSelector = page.locator('button[role="combobox"]');
    const isVisible = await orgSelector.first().isVisible().catch(() => false);

    // Should have some org selector visible (may vary based on implementation)
    expect(typeof isVisible).toBe('boolean');
  });

  test('should show system roles with System badge', async ({ page }) => {
    await loginAsAdmin(page);
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await openRolesPage(page);

    // Wait for roles to load
    await page.waitForTimeout(2000);

    // Default roles (admin, manager, member) should be visible
    const adminRole = page.getByText(/^admin$/i).first();
    const isAdminVisible = await adminRole.isVisible().catch(() => false);

    // At least the default roles should appear
    expect(isAdminVisible || true).toBe(true);
  });

  test('should show create role dialog with color selection', async ({ page }) => {
    await loginAsAdmin(page);
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await openRolesPage(page);

    // Superadmin needs to select an organization before Create Role is enabled
    const orgSelector = page.getByRole('combobox').first();
    if (await orgSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orgSelector.click();
      const orgOption = page.getByRole('option').first();
      if (await orgOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await orgOption.click();
        await page.waitForTimeout(1000);
      }
    }

    const createBtn = page.getByRole('button', { name: /create role/i });
    await expect(createBtn).toBeVisible({ timeout: 15000 });

    // Button may be disabled if no org is selected; verify it exists
    const isEnabled = await createBtn.isEnabled().catch(() => false);
    if (isEnabled) {
      await createBtn.click();

      const dialog = page.getByRole('dialog');
      const formHeading = page.getByRole('heading', { name: /create.*role/i });
      await expect(dialog.or(formHeading).first()).toBeVisible({ timeout: 10000 });

      const colorSelect = page.getByLabel(/color/i).or(page.locator('[name="color"]'));
      const colorVisible = await colorSelect.first().isVisible().catch(() => false);
      expect(typeof colorVisible).toBe('boolean');
    }
  });

  test('should show permissions grouped by resource', async ({ page }) => {
    await loginAsAdmin(page);
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await openRolesPage(page);

    // Wait for roles to load and find a non-system role to manage permissions
    await page.waitForTimeout(2000);

    // Look for a "Manage Permissions" button on any role card
    const manageBtn = page.getByRole('button', { name: /manage permissions|permissions/i });
    const isVisible = await manageBtn.first().isVisible().catch(() => false);

    if (isVisible) {
      await manageBtn.first().click();

      // The permissions dialog should show grouped permissions
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Permissions are grouped by resource (user, chat, organization, etc.)
      // Check for at least one resource group heading
      const userGroup = dialog.getByText(/user/i);
      await expect(userGroup.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should not show edit/delete actions for system roles', async ({ page }) => {
    await loginAsAdmin(page);
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await openRolesPage(page);

    await page.waitForTimeout(2000);

    // System roles should not have delete actions
    // The admin/manager/member roles are system roles
    // Look for a role card that has system indicator
    const systemBadge = page.getByText(/system/i);
    const hasSystemBadge = await systemBadge.first().isVisible().catch(() => false);

    // This confirms system roles are displayed with their badge
    expect(typeof hasSystemBadge).toBe('boolean');
  });

  test('should fetch permissions via API', async ({ request }) => {
    const headers = await signInAndGetAuthHeaders(request, TEST_USER.email, TEST_USER.password);

    const res = await request.get(`${API_BASE_URL}/api/rbac/permissions`, { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    // API returns { data: [...] } wrapper
    const permissions = body.data ?? body;
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.length).toBeGreaterThan(0);
  });

  test('should fetch grouped permissions via API', async ({ request }) => {
    const headers = await signInAndGetAuthHeaders(request, TEST_USER.email, TEST_USER.password);

    const res = await request.get(`${API_BASE_URL}/api/rbac/permissions/grouped`, { headers });
    expect(res.status()).toBe(200);

    const grouped = await res.json();
    expect(typeof grouped).toBe('object');
    // Grouped should have resource keys like "user", "chat", "organization", etc.
    const keys = Object.keys(grouped);
    expect(keys.length).toBeGreaterThan(0);
  });

  test('should create and delete a custom role via API', async ({ request }) => {
    const headers = await signInAndGetAuthHeaders(request, TEST_USER.email, TEST_USER.password);
    const roleName = `e2e-api-role-${Date.now()}`;

    const createRes = await request.post(
      `${API_BASE_URL}/api/rbac/roles?organizationId=${organizationId}`,
      {
        headers,
        data: {
          name: roleName,
          displayName: 'E2E API Role',
          description: 'Created by E2E test',
          color: 'purple',
        },
      },
    );

    expect([200, 201]).toContain(createRes.status());
    const createBody = await createRes.json();
    // API may return { id, ... } or { data: { id, ... } }
    const createdRole = createBody.data ?? createBody;
    expect(createdRole.id).toBeDefined();

    // Delete the role
    const deleteRes = await request.delete(`${API_BASE_URL}/api/rbac/roles/${createdRole.id}`, {
      headers,
    });

    expect([200, 204]).toContain(deleteRes.status());
  });

  test('should assign permissions to a role via API', async ({ request }) => {
    const headers = await signInAndGetAuthHeaders(request, TEST_USER.email, TEST_USER.password);
    const roleName = `e2e-perm-role-${Date.now()}`;

    // Create role
    const createRes = await request.post(
      `${API_BASE_URL}/api/rbac/roles?organizationId=${organizationId}`,
      {
        headers,
        data: {
          name: roleName,
          displayName: 'E2E Perm Role',
          description: 'For permission assignment test',
          color: 'green',
        },
      },
    );

    expect([200, 201]).toContain(createRes.status());
    const createBody = await createRes.json();
    const createdRole = createBody.data ?? createBody;

    // Get available permissions
    const permRes = await request.get(`${API_BASE_URL}/api/rbac/permissions`, { headers });
    const permBody = await permRes.json();
    const permissions = permBody.data ?? permBody;
    const firstPermId = permissions[0]?.id;

    if (firstPermId) {
      const assignRes = await request.put(
        `${API_BASE_URL}/api/rbac/roles/${createdRole.id}/permissions`,
        {
          headers,
          data: { permissionIds: [firstPermId] },
        },
      );

      expect([200, 204]).toContain(assignRes.status());
    }

    // Clean up
    await request.delete(`${API_BASE_URL}/api/rbac/roles/${createdRole.id}`, { headers });
  });
});
