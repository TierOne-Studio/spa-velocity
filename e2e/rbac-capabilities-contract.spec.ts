import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { API_BASE_URL } from './env';
import {
  ensureOrganizationMembership,
  ensureUserRecord,
  ensureUserWithRole,
  setActiveOrganizationForUserSessions,
  uniqueEmail,
} from './test-helpers';
import {
  loginAsRole,
  openAdminPage,
  openUserActionsMenuForEmail,
  signInAndGetAuthHeaders,
  type MatrixRoleEmails,
} from './rbac-matrix.helpers';

const DEFAULT_PASSWORD = 'MatrixPassword123!';

const adminActorEmail = uniqueEmail('e2e-rbac-cap-admin-actor');
const managerActorEmail = uniqueEmail('e2e-rbac-cap-manager-actor');
const memberActorEmail = uniqueEmail('e2e-rbac-cap-member-actor');

const memberTargetEmail = uniqueEmail('e2e-rbac-cap-member-target');
const adminTargetEmail = uniqueEmail('e2e-rbac-cap-admin-target');
const orgSlug = `e2e-rbac-cap-org-${Date.now()}`;

let managerOrganizationId = '';
let memberTargetId = '';
let adminTargetId = '';

const roleEmails: MatrixRoleEmails = {
  admin: adminActorEmail,
  manager: managerActorEmail,
  member: memberActorEmail,
};

type CapabilitiesActions = {
  update: boolean;
  setRole: boolean;
  ban: boolean;
  unban: boolean;
  setPassword: boolean;
  remove: boolean;
  impersonate: boolean;
};

async function fetchCapabilities(
  request: APIRequestContext,
  headers: Record<string, string>,
  targetUserId: string,
): Promise<CapabilitiesActions> {
  const response = await request.get(`${API_BASE_URL}/api/admin/users/${targetUserId}/capabilities`, {
    headers,
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.actions as CapabilitiesActions;
}

async function fetchMyPermissions(
  request: APIRequestContext,
  headers: Record<string, string>,
): Promise<Set<string>> {
  const response = await request.get(`${API_BASE_URL}/api/rbac/my-permissions`, { headers });
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data: unknown[] = Array.isArray(body?.data) ? body.data : [];
  return new Set(data.filter((permission): permission is string => typeof permission === 'string'));
}

async function loginAs(page: Page, role: 'admin' | 'manager' | 'member') {
  await loginAsRole(page, {
    role,
    emails: roleEmails,
    password: DEFAULT_PASSWORD,
    managerOrganizationId,
    activeOrganizationId: managerOrganizationId,
  });
}

async function openUsersPage(page: Page) {
  await openAdminPage(page, {
    path: '/admin/users',
    heading: /users/i,
  });
}

async function openActionsMenuForUser(page: Page, email: string): Promise<boolean> {
  return await openUserActionsMenuForEmail(page, email);
}

function getContractRows(
  actions: CapabilitiesActions,
  permissions: Set<string>,
): Array<{ label: RegExp; allowed: boolean }> {
  const can = (permission: string) => permissions.has(permission);

  // This contract only covers actions rendered in the Users table row menu.
  // Session revocation is exercised on the Sessions view matrix tests.

  return [
    { label: /edit user/i, allowed: actions.update && can('user:update') },
    { label: /change role/i, allowed: actions.setRole && can('user:set-role') },
    { label: /reset password/i, allowed: actions.setPassword && can('user:set-password') },
    { label: /impersonate user|impersonate/i, allowed: actions.impersonate && can('user:impersonate') },
    { label: /ban user|unban user/i, allowed: (actions.ban || actions.unban) && can('user:ban') },
    { label: /delete user/i, allowed: actions.remove && can('user:delete') },
  ];
}

async function assertMenuMatchesCapabilities(
  page: Page,
  actions: CapabilitiesActions,
  permissions: Set<string>,
) {
  const rows = getContractRows(actions, permissions);
  for (const row of rows) {
    const item = page.getByRole('menuitem', { name: row.label });
    if (row.allowed) {
      await expect(item).toBeVisible();
    } else {
      await expect(item).not.toBeVisible();
    }
  }
}

test.describe.serial('RBAC capabilities API↔UI contract', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Capabilities Admin Actor',
      role: 'admin',
    });

    await ensureUserWithRole({
      email: managerActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Capabilities Manager Actor',
      role: 'manager',
    });

    await ensureUserWithRole({
      email: memberActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Capabilities Member Actor',
      role: 'member',
    });

    const memberTarget = await ensureUserRecord({
      email: memberTargetEmail,
      name: 'E2E RBAC Capabilities Member Target',
      role: 'member',
    });
    memberTargetId = memberTarget.id;

    const adminTarget = await ensureUserRecord({
      email: adminTargetEmail,
      name: 'E2E RBAC Capabilities Admin Target',
      role: 'admin',
    });
    adminTargetId = adminTarget.id;

    managerOrganizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug,
      orgName: 'E2E RBAC Capabilities Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminActorEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E RBAC Capabilities Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberTargetEmail,
      role: 'member',
      orgSlug,
      orgName: 'E2E RBAC Capabilities Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminTargetEmail,
      role: 'admin',
      orgSlug,
      orgName: 'E2E RBAC Capabilities Org',
    });
  });

  test('admin→member: API capabilities match visible users action menu', async ({ page, request }) => {
    const headers = await signInAndGetAuthHeaders(request, adminActorEmail, DEFAULT_PASSWORD);
    await setActiveOrganizationForUserSessions({
      userEmail: adminActorEmail,
      organizationId: managerOrganizationId,
    });
    const actions = await fetchCapabilities(request, headers, memberTargetId);
    const permissions = await fetchMyPermissions(request, headers);

    await loginAs(page, 'admin');
    await openUsersPage(page);
    const menuOpened = await openActionsMenuForUser(page, memberTargetEmail);

    const hasAnyAction = getContractRows(actions, permissions).some((row) => row.allowed);
    expect(menuOpened).toBe(hasAnyAction);

    if (menuOpened) {
      await assertMenuMatchesCapabilities(page, actions, permissions);
      await page.keyboard.press('Escape');
    }
  });

  test('admin→admin target: API capabilities match whether action menu exists', async ({ page, request }) => {
    const headers = await signInAndGetAuthHeaders(request, adminActorEmail, DEFAULT_PASSWORD);
    await setActiveOrganizationForUserSessions({
      userEmail: adminActorEmail,
      organizationId: managerOrganizationId,
    });
    const actions = await fetchCapabilities(request, headers, adminTargetId);
    const permissions = await fetchMyPermissions(request, headers);

    await loginAs(page, 'admin');
    await openUsersPage(page);
    const menuOpened = await openActionsMenuForUser(page, adminTargetEmail);

    const hasAnyAction = getContractRows(actions, permissions).some((row) => row.allowed);
    expect(menuOpened).toBe(hasAnyAction);

    if (menuOpened) {
      await assertMenuMatchesCapabilities(page, actions, permissions);
      await page.keyboard.press('Escape');
    }
  });

  test('manager→member: API capabilities match visible users action menu', async ({ page, request }) => {
    const headers = await signInAndGetAuthHeaders(request, managerActorEmail, DEFAULT_PASSWORD);
    await setActiveOrganizationForUserSessions({
      userEmail: managerActorEmail,
      organizationId: managerOrganizationId,
    });

    const actions = await fetchCapabilities(request, headers, memberTargetId);
    const permissions = await fetchMyPermissions(request, headers);

    await loginAs(page, 'manager');
    await openUsersPage(page);
    const menuOpened = await openActionsMenuForUser(page, memberTargetEmail);

    const hasAnyAction = getContractRows(actions, permissions).some((row) => row.allowed);
    expect(menuOpened).toBe(hasAnyAction);

    if (menuOpened) {
      await assertMenuMatchesCapabilities(page, actions, permissions);
      await page.keyboard.press('Escape');
    }
  });

  test('forbidden user-role mutation returns 403 for authenticated manager', async ({ request }) => {
    const managerHeaders = await signInAndGetAuthHeaders(request, managerActorEmail, DEFAULT_PASSWORD);
    await setActiveOrganizationForUserSessions({
      userEmail: managerActorEmail,
      organizationId: managerOrganizationId,
    });

    const managerResponse = await request.put(`${API_BASE_URL}/api/admin/users/${memberTargetId}/role`, {
      headers: managerHeaders,
      data: { role: 'manager' },
    });
    expect(managerResponse.status()).toBe(403);
  });
});
