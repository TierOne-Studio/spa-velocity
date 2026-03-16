import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  ensureUserRecord,
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
} from './test-helpers';

const DEFAULT_PASSWORD = 'MatrixPassword123!';

const adminActorEmail = uniqueEmail('e2e-matrix-admin-actor');
const managerActorEmail = uniqueEmail('e2e-matrix-manager-actor');
const adminTargetEmail = uniqueEmail('e2e-matrix-admin-target');
const managerTargetEmail = uniqueEmail('e2e-matrix-manager-target');
const memberTargetEmail = uniqueEmail('e2e-matrix-member-target');
const orgSlug = `e2e-matrix-org-${Date.now()}`;

let organizationId = '';

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, adminActorEmail, DEFAULT_PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: adminActorEmail,
    organizationId,
  });
  await page.reload({ waitUntil: 'networkidle' });
}

async function loginAsManager(page: Page) {
  await loginWithCredentials(page, managerActorEmail, DEFAULT_PASSWORD);
  await setActiveOrganizationForUserSessions({
    userEmail: managerActorEmail,
    organizationId,
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function openUsersPage(page: Page) {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
}

async function findUserRowByEmail(page: Page, email: string): Promise<Locator> {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible();
  await searchInput.fill(email);
  await page.waitForTimeout(800);

  const targetRow = page.locator('table tbody tr', { hasText: email }).first();
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  return targetRow;
}

async function openActionsMenu(row: Locator): Promise<void> {
  const actionButton = row.getByRole('button');
  await expect(actionButton).toBeVisible();
  await actionButton.click();
}

test.describe.serial('Users page permissions matrix', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E Matrix Admin Actor',
      role: 'admin',
    });

    await ensureUserWithRole({
      email: managerActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E Matrix Manager Actor',
      role: 'manager',
    });

    await ensureUserRecord({
      email: adminTargetEmail,
      name: 'E2E Matrix Admin Target',
      role: 'admin',
    });

    await ensureUserRecord({
      email: managerTargetEmail,
      name: 'E2E Matrix Manager Target',
      role: 'manager',
    });

    await ensureUserRecord({
      email: memberTargetEmail,
      name: 'E2E Matrix Member Target',
      role: 'member',
    });

    organizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E Matrix Organization',
    });

    await ensureOrganizationMembership({
      userEmail: adminActorEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E Matrix Organization',
    });

    await ensureOrganizationMembership({
      userEmail: memberTargetEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E Matrix Organization',
    });

    await ensureOrganizationMembership({
      userEmail: adminTargetEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E Matrix Organization',
    });

    await ensureOrganizationMembership({
      userEmail: managerTargetEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E Matrix Organization',
    });
  });

  test('admin on self should only expose edit and reset password', async ({ page }) => {
    await loginAsAdmin(page);
    await openUsersPage(page);

    const selfRow = await findUserRowByEmail(page, adminActorEmail);
    await openActionsMenu(selfRow);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete user/i })).not.toBeVisible();
  });

  test('admin on other admin should have no actions', async ({ page }) => {
    await loginAsAdmin(page);
    await openUsersPage(page);

    const adminRow = await findUserRowByEmail(page, adminTargetEmail);
    const buttons = adminRow.getByRole('button');
    await expect(buttons).toHaveCount(0);
  });

  test('admin on member should expose full action set', async ({ page }) => {
    await loginAsAdmin(page);
    await openUsersPage(page);

    const memberRow = await findUserRowByEmail(page, memberTargetEmail);
    await openActionsMenu(memberRow);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /ban user|unban user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete user/i })).toBeVisible();
  });

  test('manager on self should only expose edit (no privileged actions)', async ({ page }) => {
    await loginAsManager(page);
    await openUsersPage(page);

    const selfRow = await findUserRowByEmail(page, managerActorEmail);
    await openActionsMenu(selfRow);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
  });

  test('manager on member should expose only manager-permitted actions', async ({ page }) => {
    await loginAsManager(page);
    await openUsersPage(page);

    const memberRow = await findUserRowByEmail(page, memberTargetEmail);
    await openActionsMenu(memberRow);

    await expect(page.getByRole('menuitem', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /change role/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reset password/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /impersonate/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /ban user|unban user/i })).not.toBeVisible();
  });

  test('manager should not have actions on admin or manager targets', async ({ page }) => {
    await loginAsManager(page);
    await openUsersPage(page);

    const adminRow = await findUserRowByEmail(page, adminTargetEmail);
    await expect(adminRow.getByRole('button')).toHaveCount(0);

    const managerRow = await findUserRowByEmail(page, managerTargetEmail);
    await expect(managerRow.getByRole('button')).toHaveCount(0);
  });
});
