import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserRecord,
  escapeRegExp,
  ensureUserWithRole,
  findOrganizationListItemBySlug,
  uniqueEmail,
} from '../test-helpers';
import {
  loginAsRole,
  openAdminPage,
  type MatrixRoleEmails,
} from '../rbac-matrix.helpers';

const DEFAULT_PASSWORD = 'MatrixPassword123!';

const adminActorEmail = uniqueEmail('e2e-rbac-orgs-admin-actor');
const managerActorEmail = uniqueEmail('e2e-rbac-orgs-manager-actor');
const memberActorEmail = uniqueEmail('e2e-rbac-orgs-member-actor');
const managerCandidateEmail = uniqueEmail('e2e-rbac-orgs-manager-candidate');

const managedOrgSlug = `e2e-rbac-orgs-managed-${Date.now()}`;

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

async function openOrganizationsPage(page: Page) {
  await openAdminPage(page, {
    path: '/admin/organizations',
    heading: /organizations/i,
  });
}

async function openOrganizationBySlug(page: Page, slug: string) {
  const foundButton = await findOrganizationListItemBySlug(page, slug);
  await foundButton.click();
  await expect(page.getByText(/manage members/i)).toBeVisible({ timeout: 15000 });
}

async function openAddMemberRoleDropdown(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /add member/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const roleSelect = dialog.getByRole('combobox').last();

  await expect(roleSelect).toBeVisible({ timeout: 10000 });
  await roleSelect.click();

  const listbox = page.getByRole('listbox').last();
  await expect(listbox).toBeVisible({ timeout: 5000 });
  await expect(listbox.getByRole('option', { name: /^member$/i }).first()).toBeVisible({
    timeout: 5000,
  });
  return listbox;
}

async function openAddMemberUserDropdown(page: Page) {
  await page.getByRole('button', { name: /add member/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const userSelect = dialog.getByRole('combobox').first();
  await expect(userSelect).toBeVisible({ timeout: 10000 });
  await userSelect.click();

  const candidateOption = page.getByRole('option', {
    name: new RegExp(escapeRegExp(managerCandidateEmail), 'i'),
  });
  const opened = await candidateOption.isVisible({ timeout: 3000 }).catch(() => false);
  if (!opened) {
    await userSelect.focus();
    await userSelect.press('Enter');
  }

  await expect(candidateOption).toBeVisible({ timeout: 5000 });
}

test.describe.serial('RBAC Organizations matrix (UI-aligned)', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: adminActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Orgs Admin Actor',
      role: 'admin',
    });

    await ensureUserWithRole({
      email: managerActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Orgs Manager Actor',
      role: 'manager',
    });

    await ensureUserWithRole({
      email: memberActorEmail,
      password: DEFAULT_PASSWORD,
      name: 'E2E RBAC Orgs Member Actor',
      role: 'member',
    });

    await ensureUserRecord({
      email: managerCandidateEmail,
      name: 'E2E Manager Candidate User',
      role: 'member',
    });

    managerOrganizationId = await ensureOrganizationMembership({
      userEmail: managerActorEmail,
      role: 'manager',
      orgSlug: managedOrgSlug,
      orgName: 'E2E RBAC Organizations Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: adminActorEmail,
      role: 'admin',
      orgSlug: managedOrgSlug,
      orgName: 'E2E RBAC Organizations Matrix Org',
    });

    await ensureOrganizationMembership({
      userEmail: memberActorEmail,
      role: 'member',
      orgSlug: managedOrgSlug,
      orgName: 'E2E RBAC Organizations Matrix Org',
    });
  });

  test('admin, manager, and member can access organizations page when permissions and org context allow it', async ({ page }) => {
    await loginAs(page, 'admin');
    await openOrganizationsPage(page);

    await loginAs(page, 'manager');
    await openOrganizationsPage(page);

    await loginAs(page, 'member');
    await openOrganizationsPage(page);
  });

  test('create organization action is available for admin', async ({ page }) => {
    await loginAs(page, 'admin');
    await openOrganizationsPage(page);
    await expect(page.getByRole('button', { name: /^create organization$/i })).toBeVisible();
  });

  test('add member action is visible for admin and manager on selected organization', async ({ page }) => {
    await loginAs(page, 'admin');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    await expect(page.getByRole('button', { name: /add member/i })).toBeVisible();

    await loginAs(page, 'manager');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    await expect(page.getByRole('button', { name: /add member/i })).toBeVisible();
  });

  test('manager add-member dialog lists existing non-member user candidates', async ({ page }) => {
    await loginAs(page, 'manager');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    await openAddMemberUserDropdown(page);

    await expect(
      page.getByRole('option', { name: new RegExp(escapeRegExp(managerCandidateEmail), 'i') }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('manager add-member role dropdown includes admin option in the current UI', async ({ page }) => {
    await loginAs(page, 'manager');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    const roleListbox = await openAddMemberRoleDropdown(page);

    await expect(roleListbox.getByRole('option', { name: /^admin$/i }).first()).toBeVisible();
    await expect(roleListbox.getByRole('option', { name: /^manager$/i }).first()).toBeVisible();
    await expect(roleListbox.getByRole('option', { name: /^member$/i }).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('admin add-member role dropdown includes admin option', async ({ page }) => {
    await loginAs(page, 'admin');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    const roleListbox = await openAddMemberRoleDropdown(page);

    await expect(roleListbox.getByRole('option', { name: /^admin$/i }).first()).toBeVisible();
    await expect(roleListbox.getByRole('option', { name: /^manager$/i }).first()).toBeVisible();
    await expect(roleListbox.getByRole('option', { name: /^member$/i }).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });
});
