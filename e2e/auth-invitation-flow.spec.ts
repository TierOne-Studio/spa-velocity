import { test, expect, type Page } from '@playwright/test';
import { TEST_USER } from './env';

const INVITATION_ID = 'e2e-pending-invitation-id';

async function clearAuthState(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL(/\/(chat|dashboard)?$/, { timeout: 15000 });
}

test.describe('Invitation acceptance continuation flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('should show sign-in and sign-up actions when opening invitation unauthenticated', async ({ page }) => {
    await page.goto(`/accept-invitation/${INVITATION_ID}`);

    await expect(page.getByText('Organization Invitation')).toBeVisible();
    await expect(page.getByText(/please sign in to continue/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign up$/i })).toBeVisible();
  });

  test('should persist pendingInvitationId and redirect to login from invitation page', async ({ page }) => {
    await page.goto(`/accept-invitation/${INVITATION_ID}`);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL('/login');

    const pendingInvitationId = await page.evaluate(() => sessionStorage.getItem('pendingInvitationId'));
    expect(pendingInvitationId).toBe(INVITATION_ID);
  });

  test('should persist pendingInvitationId and redirect to signup from invitation page', async ({ page }) => {
    await page.goto(`/accept-invitation/${INVITATION_ID}`);
    await page.getByRole('button', { name: /^sign up$/i }).click();

    await expect(page).toHaveURL('/signup');

    const pendingInvitationId = await page.evaluate(() => sessionStorage.getItem('pendingInvitationId'));
    expect(pendingInvitationId).toBe(INVITATION_ID);
  });

  test('should redirect authenticated user from login to pending invitation page', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate((invitationId: string) => {
      sessionStorage.setItem('pendingInvitationId', invitationId);
    }, INVITATION_ID);

    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: /^login$/i }).click();

    await expect(page).toHaveURL(new RegExp(`/accept-invitation/${INVITATION_ID}$`), {
      timeout: 15000,
    });

    const pendingInvitationId = await page.evaluate(() => sessionStorage.getItem('pendingInvitationId'));
    expect(pendingInvitationId).toBeNull();
  });

  test('should show deterministic error state for invalid invitation id when authenticated', async ({ page }) => {
    await login(page);

    await page.goto('/accept-invitation/invalid-invitation-id');

    await expect(page.getByText('Organization Invitation')).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /go to dashboard/i })).toBeVisible();
    await expect(page.getByText(/processing your invitation/i)).not.toBeVisible();
  });
});
