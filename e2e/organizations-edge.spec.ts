import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from './env';
import {
  ensureOrganizationMembership,
  ensureTestUserExists,
  ensureUserRecord,
  escapeRegExp,
  findOrganizationListItemBySlug,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  withDatabase,
} from './test-helpers';
import { resendTestEmail } from '../src/shared/utils/resendTestEmail';

const EXISTING_ORG_SLUG = `e2e-org-existing-${Date.now()}`;
const MANAGE_ORG_SLUG = `e2e-org-manage-${Date.now()}`;
const MANAGE_MEMBER_EMAIL = resendTestEmail('delivered', `e2e-org-member-${Date.now()}`);
const ADD_MEMBER_CANDIDATE_EMAIL = resendTestEmail('delivered', `e2e-org-candidate-${Date.now()}`);

async function ensureOrganization(slug: string, name: string): Promise<void> {
  await ensureOrganizationMembership({
    userEmail: TEST_USER.email,
    role: 'admin',
    orgSlug: slug,
    orgName: name,
  });
}

async function ensureMemberInOrganization(params: {
  orgSlug: string;
  email: string;
  name: string;
}): Promise<void> {
  await withDatabase(async (pool) => {
    const orgResult = await pool.query<{ id: string }>(
      `SELECT id FROM organization WHERE slug = $1`,
      [params.orgSlug],
    );

    if (orgResult.rowCount === 0) {
      throw new Error(`Organization not found for member fixture: ${params.orgSlug}`);
    }

    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'member', true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'member', "updatedAt" = NOW()
       RETURNING id`,
      [params.name, params.email],
    );

    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'member', NOW())
       ON CONFLICT DO NOTHING`,
      [orgResult.rows[0].id, userResult.rows[0].id],
    );
  });
}

async function loginAsAdmin(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  const organizationId = await withDatabase(async (pool) => {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM organization WHERE slug = $1`,
      [MANAGE_ORG_SLUG],
    );
    return result.rows[0]?.id ?? null;
  });

  if (organizationId) {
    await setActiveOrganizationForUserSessions({
      userEmail: TEST_USER.email,
      organizationId,
    });
    await page.reload({ waitUntil: 'networkidle' });
  }
}

async function openOrganizationBySlug(page: Page, slug: string) {
  const orgRow = await findOrganizationListItemBySlug(page, slug);
  await orgRow.click();
}

async function openAddMemberUserDropdown(page: Page) {
  const dialog = page.getByRole('dialog');
  const userSelect = dialog.getByRole('combobox').first();

  await expect(userSelect).toBeVisible({ timeout: 10000 });
  await userSelect.click();

  const candidateOption = page.getByRole('option', {
    name: new RegExp(escapeRegExp(ADD_MEMBER_CANDIDATE_EMAIL), 'i'),
  });

  const opened = await candidateOption.isVisible({ timeout: 3000 }).catch(() => false);
  if (!opened) {
    await userSelect.focus();
    await userSelect.press('Enter');
  }

  await expect(candidateOption).toBeVisible({ timeout: 5000 });
}

async function openOrganizationsPage(page: Page) {
  await page.goto('/admin/organizations');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /organizations/i })).toBeVisible();
}

test.describe('Organizations edge cases', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });
    await ensureOrganization(EXISTING_ORG_SLUG, 'E2E Existing Organization');
    await ensureOrganization(MANAGE_ORG_SLUG, 'E2E Manage Organization');
    await ensureUserRecord({
      email: ADD_MEMBER_CANDIDATE_EMAIL,
      name: 'E2E Candidate User',
      role: 'member',
    });
    await ensureMemberInOrganization({
      orgSlug: MANAGE_ORG_SLUG,
      email: MANAGE_MEMBER_EMAIL,
      name: 'E2E Manage Member',
    });
  });

  test('create organization should enforce slug availability before submit', async ({ page }) => {
    await loginAsAdmin(page);
    await openOrganizationsPage(page);

    const createOrganizationButton = page.getByRole('button', { name: /^create organization$/i });
    await expect(createOrganizationButton).toBeVisible({ timeout: 10000 });
    await createOrganizationButton.click();
    const dialog = page.getByRole('dialog');

    const isDialogVisible = await dialog.isVisible({ timeout: 1500 }).catch(() => false);
    if (!isDialogVisible) {
      await createOrganizationButton.click();
    }

    await expect(dialog).toBeVisible({ timeout: 10000 });

    await dialog.getByLabel('Name').fill('E2E Slug Validation Org');

    await dialog.locator('input#org-slug').fill(EXISTING_ORG_SLUG);

    const createButton = dialog.getByRole('button', { name: /^create$/i });
    // Wait for slug validation to complete (button disabled while checking or taken)
    await expect(createButton).toBeDisabled({ timeout: 15000 });

    const availableSlug = `e2e-org-available-${Date.now()}`;
    await dialog.locator('input#org-slug').fill(availableSlug);
    await expect(dialog.getByText(/available/i)).toBeVisible({ timeout: 10000 });
    await expect(createButton).toBeEnabled();
  });

  test('add member dialog should keep submit disabled until a user is selected', async ({ page }) => {
    await loginAsAdmin(page);
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, MANAGE_ORG_SLUG);

    await page.getByRole('button', { name: /add member/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const addButton = dialog.getByRole('button', { name: /^add member$/i });
    await expect(addButton).toBeDisabled();

    await openAddMemberUserDropdown(page);
    await expect(
      page.getByRole('option', { name: new RegExp(escapeRegExp(ADD_MEMBER_CANDIDATE_EMAIL), 'i') }),
    ).toBeVisible();
  });

  test('cancel remove member should keep member count unchanged', async ({ page }) => {
    await loginAsAdmin(page);
    await openOrganizationsPage(page);
    await openOrganizationBySlug(page, MANAGE_ORG_SLUG);

    const targetMemberRow = page.locator('table tbody tr', { hasText: MANAGE_MEMBER_EMAIL }).first();
    await expect(targetMemberRow).toBeVisible({ timeout: 15000 });

    const memberRows = page.locator('table tbody tr');
    const beforeCount = await memberRows.count();

    const removeButton = targetMemberRow.getByRole('button');
    await removeButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    const afterCount = await page.locator('table tbody tr').count();
    expect(afterCount).toBe(beforeCount);
  });
});
