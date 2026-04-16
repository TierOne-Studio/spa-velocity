import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
} from './test-helpers';

const MANAGER_PASSWORD = 'ManagerPassword123!';
const MEMBER_PASSWORD = 'MemberPassword123!';

const managerEmail = uniqueEmail('e2e-guard-manager');
const memberEmail = uniqueEmail('e2e-guard-member');
const orgSlug = `e2e-guard-org-${Date.now()}`;

const adminRoutes = ['/admin/users', '/admin/sessions', '/admin/organizations', '/admin/roles'];

let managerOrganizationId = '';

async function loginAsManager(page: Page) {
  await loginWithCredentials(page, managerEmail, MANAGER_PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: managerEmail,
    organizationId: managerOrganizationId,
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function loginAsMember(page: Page) {
  await loginWithCredentials(page, memberEmail, MEMBER_PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: memberEmail,
    organizationId: managerOrganizationId,
  });
  await page.reload({ waitUntil: 'networkidle' });
}

test.describe('Route guard behavior', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: managerEmail,
      password: MANAGER_PASSWORD,
      name: 'E2E Guard Manager',
      role: 'manager',
    });

    await ensureUserWithRole({
      email: memberEmail,
      password: MEMBER_PASSWORD,
      name: 'E2E Guard Member',
      role: 'member',
    });

    managerOrganizationId = await ensureOrganizationMembership({
      userEmail: managerEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E Guard Organization',
    });

    await ensureOrganizationMembership({
      userEmail: memberEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E Guard Organization',
    });
  });

  test('unauthenticated users should be redirected to /login for all admin routes', async ({ page }) => {
    for (const route of adminRoutes) {
      await page.context().clearCookies();
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto(route);
      await expect(page).toHaveURL('/login');
      await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible();
    }
  });

  test('member should only access organizations route with org context and be blocked from users, roles, and sessions', async ({ page }) => {
    await loginAsMember(page);

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 10000 });

    await page.goto('/admin/organizations');
    await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible({ timeout: 10000 });

    await page.goto('/admin/roles');
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 10000 });

    await page.goto('/admin/sessions');
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 10000 });

    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Member sees organizations link but not admin-only links
    await expect(sidebar.getByRole('link', { name: /^organizations$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^users$/i })).not.toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^roles/i })).not.toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^sessions$/i })).not.toBeVisible();
  });

  test('manager should access admin routes but not see create role action', async ({ page }) => {
    await loginAsManager(page);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();

    await page.goto('/admin/sessions');
    await expect(page.getByRole('heading', { name: /user sessions/i })).toBeVisible();

    await page.goto('/admin/organizations');
    await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();

    await page.goto('/admin/roles');
    await expect(page.getByRole('heading', { name: /roles & permissions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create role/i })).not.toBeVisible();
  });

  test('unknown routes should resolve to guarded defaults', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/definitely-not-a-real-route');
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    await loginAsManager(page);
    await page.goto('/another-unknown-route');
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 10000 });
    // Sidebar should be visible after redirect to authenticated default
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible({ timeout: 10000 });
  });
});
