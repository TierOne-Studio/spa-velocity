import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserRecord,
  ensureUserWithRole,
  uniqueEmail,
  withDatabase,
} from '../test-helpers';
import {
  loginAsRole,
  openAdminPage,
  type MatrixRoleEmails,
} from '../rbac-matrix.helpers';

const DEFAULT_PASSWORD = 'MatrixPassword123!';

const adminActorEmail = uniqueEmail('e2e-rbac-sessions-admin-actor');
const managerActorEmail = uniqueEmail('e2e-rbac-sessions-manager-actor');
const memberActorEmail = uniqueEmail('e2e-rbac-sessions-member-actor');

const sessionsTargetEmail = uniqueEmail('e2e-rbac-sessions-target');
const sessionsTargetName = 'E2E RBAC Sessions Target';
const orgSlug = `e2e-rbac-sessions-org-${Date.now()}`;

let organizationId = '';
let sessionsTargetUserId = '';

const roleEmails: MatrixRoleEmails = {
  admin: adminActorEmail,
  manager: managerActorEmail,
  member: memberActorEmail,
};

async function ensureActiveSessionForUser(userId: string): Promise<void> {
  await withDatabase(async (pool) => {
    await pool.query('DELETE FROM session WHERE "userId" = $1', [userId]);
    await pool.query(
      `INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent")
       VALUES (gen_random_uuid()::text, $1, gen_random_uuid()::text, NOW() + INTERVAL '1 day', NOW(), NOW(), '127.0.0.1', 'E2E Sessions Matrix Browser')`,
      [userId],
    );
  });
}

async function loginAs(page: Page, role: 'admin' | 'manager' | 'member') {
  await loginAsRole(page, {
    role,
    emails: roleEmails,
    password: DEFAULT_PASSWORD,
    managerOrganizationId: organizationId,
    activeOrganizationId: organizationId,
  });
}

async function openSessionsPage(page: Page) {
  await openAdminPage(page, {
    path: '/admin/sessions',
    heading: /user sessions/i,
  });
}

async function selectSessionsTargetUser(page: Page) {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(sessionsTargetName);
  await page.waitForTimeout(1200);

  const targetUserButton = page.locator('main button').filter({ hasText: new RegExp(sessionsTargetName, 'i') }).first();
  await expect(targetUserButton).toBeVisible({ timeout: 15000 });
  await targetUserButton.click();
}

test.describe.serial('RBAC Sessions matrix (UI-aligned)', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Sessions Admin Actor',
      role: 'admin',
    });

    await ensureUserWithRole({
      email: managerActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Sessions Manager Actor',
      role: 'manager',
    });

    await ensureUserWithRole({
      email: memberActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Sessions Member Actor',
      role: 'member',
    });

    const targetUser = await ensureUserRecord({
      email: sessionsTargetEmail,
      name: sessionsTargetName,
      role: 'member',
    });

    sessionsTargetUserId = targetUser.id;

    organizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E RBAC Sessions Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminActorEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E RBAC Sessions Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberActorEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E RBAC Sessions Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: sessionsTargetEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E RBAC Sessions Matrix Org',
    });

    await ensureActiveSessionForUser(sessionsTargetUserId);
  });

  test('admin and manager can access sessions page; member is redirected', async ({ page }) => {
    await loginAs(page, 'admin');
    await openSessionsPage(page);

    await loginAs(page, 'manager');
    await openSessionsPage(page);

    await loginAs(page, 'member');
    await page.goto('/admin/sessions');
    await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });
    // Member is redirected to default page — sidebar should be visible
    await expect(page.locator('[data-slot="sidebar"]')).toBeVisible({ timeout: 10000 });
  });

  test('admin can see revoke-all and per-session revoke actions', async ({ page }) => {
    await ensureActiveSessionForUser(sessionsTargetUserId);

    await loginAs(page, 'admin');
    await openSessionsPage(page);
    await selectSessionsTargetUser(page);

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('button', { name: /revoke all/i })).toBeVisible();
    await expect(rows.first().getByRole('button')).toBeVisible();
  });

  test('manager can see revoke-all and per-session revoke actions', async ({ page }) => {
    await ensureActiveSessionForUser(sessionsTargetUserId);

    await loginAs(page, 'manager');
    await openSessionsPage(page);
    await selectSessionsTargetUser(page);

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('button', { name: /revoke all/i })).toBeVisible();
    await expect(rows.first().getByRole('button')).toBeVisible();
  });

  test('revoke-all dialog opens and can be cancelled without removing all rows', async ({ page }) => {
    await ensureActiveSessionForUser(sessionsTargetUserId);

    await loginAs(page, 'manager');
    await openSessionsPage(page);
    await selectSessionsTargetUser(page);

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    const beforeCount = await rows.count();

    await page.getByRole('button', { name: /revoke all/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    const afterCount = await page.locator('table tbody tr').count();
    expect(afterCount).toBe(beforeCount);
  });
});
