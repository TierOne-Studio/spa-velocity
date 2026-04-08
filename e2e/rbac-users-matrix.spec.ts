import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserRecord,
  ensureUserWithRole,
  uniqueEmail,
} from './test-helpers';
import {
  findUserRowByEmail,
  loginAsRole,
  openAdminPage,
  openUserActionsMenuForEmail,
  type MatrixRoleEmails,
} from './rbac-matrix.helpers';

const DEFAULT_PASSWORD = 'MatrixPassword123!';

const adminActorEmail = uniqueEmail('e2e-rbac-users-admin-actor');
const managerActorEmail = uniqueEmail('e2e-rbac-users-manager-actor');
const memberActorEmail = uniqueEmail('e2e-rbac-users-member-actor');

const adminTargetEmail = uniqueEmail('e2e-rbac-users-admin-target');
const managerTargetEmail = uniqueEmail('e2e-rbac-users-manager-target');
const memberTargetEmail = uniqueEmail('e2e-rbac-users-member-target');

const orgSlug = `e2e-rbac-users-org-${Date.now()}`;

let organizationId = '';

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
    managerOrganizationId: organizationId,
    activeOrganizationId: organizationId,
  });
}

async function openUsersPage(page: Page) {
  await openAdminPage(page, {
    path: '/admin/users',
    heading: /users/i,
  });
}

async function openActionsMenuForEmail(page: Page, email: string) {
  const menuOpened = await openUserActionsMenuForEmail(page, email);
  expect(menuOpened).toBe(true);
}

test.describe.serial('RBAC Users matrix (UI-aligned)', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Users Admin Actor',
      role: 'admin',
    });

    await ensureUserWithRole({
      email: managerActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Users Manager Actor',
      role: 'manager',
    });

    await ensureUserWithRole({
      email: memberActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Users Member Actor',
      role: 'member',
    });

    await ensureUserRecord({
      email: adminTargetEmail,
      name: 'E2E RBAC Users Admin Target',
      role: 'admin',
    });

    await ensureUserRecord({
      email: managerTargetEmail,
      name: 'E2E RBAC Users Manager Target',
      role: 'manager',
    });

    await ensureUserRecord({
      email: memberTargetEmail,
      name: 'E2E RBAC Users Member Target',
      role: 'member',
    });

    organizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E RBAC Users Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminActorEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E RBAC Users Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberActorEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E RBAC Users Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminTargetEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E RBAC Users Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: managerTargetEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E RBAC Users Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberTargetEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E RBAC Users Matrix Org',
    });
  });

  test('admin can access users page', async ({ page }) => {
    await loginAs(page, 'admin');
    await openUsersPage(page);
  });

  test('manager can access users page', async ({ page }) => {
    await loginAs(page, 'manager');
    await openUsersPage(page);
  });

  test('member is redirected from users page without user:read permission', async ({ page }) => {
    await loginAs(page, 'member');
    await page.goto('/admin/users');
    await expect(page).toHaveURL('/');
  });

  test('admin on self: only edit + reset password actions are visible', async ({ page }) => {
    await loginAs(page, 'admin');
    await openUsersPage(page);
    await openActionsMenuForEmail(page, adminActorEmail);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete user/i })).not.toBeVisible();
  });

  test('admin on member: full action set is visible', async ({ page }) => {
    await loginAs(page, 'admin');
    await openUsersPage(page);
    await openActionsMenuForEmail(page, memberTargetEmail);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /ban user|unban user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete user/i })).toBeVisible();
  });

  test('admin on another admin: no action button is rendered', async ({ page }) => {
    await loginAs(page, 'admin');
    await openUsersPage(page);

    const adminRow = await findUserRowByEmail(page, adminTargetEmail);
    await expect(adminRow.getByRole('button')).toHaveCount(0);
  });

  test('manager on self: only edit action is visible', async ({ page }) => {
    await loginAs(page, 'manager');
    await openUsersPage(page);
    await openActionsMenuForEmail(page, managerActorEmail);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete user/i })).not.toBeVisible();
  });

  test('manager on member: allowed actions only (edit)', async ({ page }) => {
    await loginAs(page, 'manager');
    await openUsersPage(page);
    await openActionsMenuForEmail(page, memberTargetEmail);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete user/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /ban user|unban user/i })).not.toBeVisible();
  });

  test('manager on admin or manager targets: no action button is rendered', async ({ page }) => {
    await loginAs(page, 'manager');
    await openUsersPage(page);

    const adminRow = await findUserRowByEmail(page, adminTargetEmail);
    await expect(adminRow.getByRole('button')).toHaveCount(0);

    const managerRow = await findUserRowByEmail(page, managerTargetEmail);
    await expect(managerRow.getByRole('button')).toHaveCount(0);
  });
});
