import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserRecord,
  escapeRegExp,
  ensureUserWithRole,
  uniqueEmail,
} from './test-helpers';
import {
  loginAsRole,
  openAdminPage,
  type MatrixRoleEmails,
} from './rbac-matrix.helpers';

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
  });
}

async function openOrganizationsPage(page: Page) {
  await openAdminPage(page, {
    path: '/admin/organizations',
    heading: /organizations/i,
  });
}

async function openOrganizationBySlug(page: Page, slug: string) {
  const searchInput = page.getByPlaceholder(/search organizations/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(slug);
  await page.waitForTimeout(500); // Wait for search to filter

  // Button text format is "OrgName/slug" - find button containing the slug
  const allOrgButtons = page.locator('main button').filter({ hasText: /\// });
  const count = await allOrgButtons.count();
  
  let foundButton = null;
  for (let i = 0; i < count; i++) {
    const button = allOrgButtons.nth(i);
    const text = await button.textContent();
    if (text && text.toLowerCase().includes(`/${slug.toLowerCase()}`)) {
      foundButton = button;
      break;
    }
  }

  if (!foundButton) {
    const visibleOrgLabels = await allOrgButtons.allTextContents();
    throw new Error(
      `Could not find organization button for slug "${slug}" after search. Visible organization labels: ${visibleOrgLabels.join(', ') || '(none)'}`,
    );
  }

  await foundButton.click();
  await expect(page.getByText(/manage members/i)).toBeVisible({ timeout: 15000 });
}

async function openAddMemberRoleDropdown(page: Page) {
  await page.getByRole('button', { name: /add member/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const roleSelect = dialog.getByRole('combobox').nth(1);

  await expect(roleSelect).toBeVisible({ timeout: 10000 });

  const memberOption = page.getByRole('option', { name: /^member$/i });
  await roleSelect.evaluate((el) => {
    (el as HTMLElement).click();
  });

  const opened = await memberOption.isVisible({ timeout: 3000 }).catch(() => false);
  if (!opened) {
    await roleSelect.focus();
    await roleSelect.press('Enter');
  }

  await expect(memberOption).toBeVisible({ timeout: 5000 });
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
  });

  test('admin and manager can access organizations page; member is redirected', async ({ page }) => {
    await loginAs(page, 'admin');
    await openOrganizationsPage(page);

    await loginAs(page, 'manager');
    await openOrganizationsPage(page);

    await loginAs(page, 'member');
    await page.goto('/admin/organizations');
    await expect(page).toHaveURL('/');
    await expect(
      page.locator('[data-slot="sidebar"]').getByRole('link', { name: /^dashboard$/i }),
    ).toBeVisible();
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

  test('manager add-member role dropdown excludes admin option', async ({ page }) => {
    await loginAs(page, 'manager');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    await openAddMemberRoleDropdown(page);

    await expect(page.getByRole('option', { name: /^admin$/i })).not.toBeVisible();
    await expect(page.getByRole('option', { name: /^manager$/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /^member$/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });

  test('admin add-member role dropdown includes admin option', async ({ page }) => {
    await loginAs(page, 'admin');
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, managedOrgSlug);
    await openAddMemberRoleDropdown(page);

    await expect(page.getByRole('option', { name: /^admin$/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /^manager$/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /^member$/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });
});
