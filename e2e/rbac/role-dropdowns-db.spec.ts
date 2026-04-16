import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USER } from '../env';
import {
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganizationForUserSessions,
} from '../rbac-role-helpers';

test.describe.serial('Unified Role Dropdowns - Database-Driven', () => {
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

test.describe('Cleanup', () => {
  test('restore admin role for test user', async () => {
    await setUserRole('admin');
  });
});
