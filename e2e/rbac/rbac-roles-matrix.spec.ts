import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  uniqueEmail,
} from '../test-helpers';
import {
  loginAsRole,
  openAdminPage,
  type MatrixRoleEmails,
} from '../rbac-matrix.helpers';

const DEFAULT_PASSWORD = 'MatrixPassword123!';

const adminActorEmail = uniqueEmail('e2e-rbac-roles-admin-actor');
const managerActorEmail = uniqueEmail('e2e-rbac-roles-manager-actor');
const memberActorEmail = uniqueEmail('e2e-rbac-roles-member-actor');

const orgSlug = `e2e-rbac-roles-org-${Date.now()}`;

let managerOrganizationId = '';

const roleEmails: MatrixRoleEmails = {
  admin: adminActorEmail,
  manager: managerActorEmail,
  member: memberActorEmail,
};

async function loginAs(page: Page, role: 'admin' | 'manager' | 'member') {
  await loginAsRole(page, {
    role,
    emails: roleEmails,
    password: DEFAULT_PASSWORD,
    managerOrganizationId,
    activeOrganizationId: managerOrganizationId,
  });
}

async function openRolesPage(page: Page) {
  await openAdminPage(page, {
    path: '/admin/roles',
    heading: /roles & permissions/i,
  });
}

test.describe.serial('RBAC Roles matrix (UI-aligned)', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Roles Admin Actor',
      role: 'admin',
    });

    await ensureUserWithRole({
      email: managerActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Roles Manager Actor',
      role: 'manager',
    });

    await ensureUserWithRole({
      email: memberActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Roles Member Actor',
      role: 'member',
    });

    managerOrganizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E RBAC Roles Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminActorEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E RBAC Roles Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberActorEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E RBAC Roles Matrix Org',
    });
  });

  test('admin and manager can access roles page when organization context exists', async ({ page }) => {
    await loginAs(page, 'admin');
    await openRolesPage(page);

    await loginAs(page, 'manager');
    await openRolesPage(page);
  });

  test('member is redirected from roles page without role:read permission', async ({ page }) => {
    await loginAs(page, 'member');
    await page.goto('/admin/roles');
    await expect(page).toHaveURL(/\/(chat|dashboard)?$/);
  });

  test('admin sees create role action and all system role cards', async ({ page }) => {
    await loginAs(page, 'admin');
    await openRolesPage(page);

    await expect(page.getByRole('button', { name: /create role/i })).toBeVisible();
    await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="role-card-manager"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="role-card-member"]').first()).toBeVisible();
  });

  test('manager sees all system role cards and no create role action', async ({ page }) => {
    await loginAs(page, 'manager');
    await openRolesPage(page);

    await expect(page.getByRole('button', { name: /create role/i })).not.toBeVisible();
    await expect(page.locator('[data-testid="role-card-admin"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="role-card-manager"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="role-card-member"]').first()).toBeVisible();
  });

  test('manager cannot see manage permissions action on member role without role:assign', async ({ page }) => {
    await loginAs(page, 'manager');
    await openRolesPage(page);

    const memberCard = page.locator('[data-testid="role-card-member"]').first();
    await expect(memberCard).toBeVisible();
    await expect(memberCard.getByRole('button', { name: /manage/i })).toHaveCount(0);
    await expect(memberCard.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
    await expect(memberCard.locator('button.text-destructive')).toHaveCount(0);
  });

  test('admin can see manage action on role cards', async ({ page }) => {
    await loginAs(page, 'admin');
    await openRolesPage(page);

    const memberCard = page.locator('[data-testid="role-card-member"]').first();
    await expect(memberCard).toBeVisible();
    await expect(memberCard.getByRole('button', { name: /manage/i })).toBeVisible();
  });
});
