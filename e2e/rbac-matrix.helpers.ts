import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { API_BASE_URL } from './env';
import { loginWithCredentials, setActiveOrganizationForUserSessions } from './test-helpers';

export type MatrixRole = 'admin' | 'manager' | 'member';

export type MatrixRoleEmails = {
  admin: string;
  manager: string;
  member: string;
};

export async function signInAndGetAuthHeaders(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const signInRes = await request.post(`${API_BASE_URL}/api/auth/sign-in/email`, {
    data: { email, password },
  });

  expect(signInRes.status()).toBe(200);
  const signInData = await signInRes.json();
  const token = signInData.token || signInData.session?.token;
  expect(token).toBeTruthy();

  return { Authorization: `Bearer ${token as string}` };
}

export async function loginAsRole(page: Page, params: {
  role: MatrixRole;
  emails: MatrixRoleEmails;
  password: string;
  managerOrganizationId?: string;
  activeOrganizationId?: string;
}) {
  await loginWithCredentials(page, params.emails[params.role], params.password);

  const organizationId =
    params.activeOrganizationId ??
    (params.role === 'manager' ? params.managerOrganizationId : undefined);

  if (organizationId) {
    await setActiveOrganizationForUserSessions({
      userEmail: params.emails[params.role],
      organizationId,
    });
    await page.reload({ waitUntil: 'networkidle' });
  }
}

export async function openAdminPage(page: Page, params: {
  path: '/admin/users' | '/admin/sessions' | '/admin/organizations' | '/admin/roles';
  heading: RegExp;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(params.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: params.heading });
    const isHeadingVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);
    if (isHeadingVisible) {
      return;
    }
  }

  await expect(page).toHaveURL(params.path, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: params.heading })).toBeVisible({ timeout: 15000 });
}

export async function findUserRowByEmail(page: Page, email: string): Promise<Locator> {
  const searchInput = page.getByPlaceholder(/search users/i);
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.click();
  await searchInput.fill('');
  await searchInput.fill(email);
  await page.waitForTimeout(800);

  const targetRow = page.locator('table tbody tr', { hasText: email }).first();
  await expect(targetRow).toBeVisible({ timeout: 15000 });
  return targetRow;
}

export async function openUserActionsMenuForEmail(page: Page, email: string): Promise<boolean> {
  const row = await findUserRowByEmail(page, email);
  const actionBtn = row.getByRole('button');

  if ((await actionBtn.count()) === 0) {
    return false;
  }

  await expect(actionBtn.first()).toBeVisible();
  await actionBtn.first().click();
  return true;
}
