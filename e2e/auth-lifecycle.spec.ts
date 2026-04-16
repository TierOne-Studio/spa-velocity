import { test, expect, type Page } from '@playwright/test';

import { API_BASE_URL, TEST_USER } from './env';
import {
  clearAuthState,
  loginWithCredentials,
  uniqueEmail,
  withDatabase,
} from './test-helpers';

test.describe('Auth lifecycle — signup validation', () => {
  test('should show password mismatch error on signup', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Full Name').fill('Test Mismatch');
    await page.getByLabel('Email').fill(uniqueEmail('signup-mismatch'));
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm Password').fill('different123');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show error toast for password mismatch
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state during signup submission', async ({ page }) => {
    // Slow down the API to see loading state
    await page.route('**/api/auth/sign-up/email', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'mock' } }),
      });
    });

    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Full Name').fill('Loading Test');
    await page.getByLabel('Email').fill(uniqueEmail('signup-loading'));
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm Password').fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show "Creating account..." text
    await expect(page.getByRole('button', { name: /creating account/i })).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to pending-approval after successful signup', async ({ page }) => {
    const email = uniqueEmail('signup-pending');

    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Full Name').fill('Pending User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm Password').fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to pending-approval or show success
    await expect(page).toHaveURL(/\/(pending-approval|login)/, { timeout: 15000 });
  });

  test('should show Google signup button', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /sign up with google/i })).toBeVisible();
  });
});

test.describe('Auth lifecycle — forgot password success state', () => {
  test('should show success state after submitting forgot password', async ({ page }) => {
    // Mock the forgot password endpoint to succeed
    await page.route('**/api/auth/request-password-reset', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Should show the success state with "Check your email"
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/test@example.com/i)).toBeVisible();
  });

  test('should show Try another email button in success state', async ({ page }) => {
    await page.route('**/api/auth/request-password-reset', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /try another email/i })).toBeVisible();
  });

  test('should return to form when clicking Try another email', async ({ page }) => {
    await page.route('**/api/auth/request-password-reset', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /try another email/i }).click();

    // Should be back to the form state
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('should show loading state during forgot password submission', async ({ page }) => {
    await page.route('**/api/auth/request-password-reset', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Button should be disabled and show "Sending..." while submitting
    const sendingButton = page.getByRole('button', { name: /sending/i });
    await expect(sendingButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Auth lifecycle — set new password states', () => {
  test('should show invalid link when no token provided', async ({ page }) => {
    await page.goto('/set-new-password', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/invalid link/i)).toBeVisible();
  });

  test('should show request new reset link button on invalid token', async ({ page }) => {
    await page.goto('/set-new-password', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
  });

  test('request new reset link should navigate to forgot-password', async ({ page }) => {
    await page.goto('/set-new-password', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /request new reset link/i }).click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should show password form with valid token', async ({ page }) => {
    await page.goto('/set-new-password?token=valid-test-token', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/set new password/i)).toBeVisible();
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
  });

  test('should show password mismatch error', async ({ page }) => {
    await page.goto('/set-new-password?token=valid-test-token', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('New Password').fill('password123');
    await page.getByLabel('Confirm Password').fill('different456');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show success state after successful password reset', async ({ page }) => {
    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/set-new-password?token=valid-test-token', { waitUntil: 'domcontentloaded' });

    await page.getByLabel('New Password').fill('newpassword123');
    await page.getByLabel('Confirm Password').fill('newpassword123');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/password reset successful/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /go to login/i })).toBeVisible();
  });
});

test.describe('Auth lifecycle — verify email states', () => {
  test('should show error without token', async ({ page }) => {
    await page.goto('/verify-email', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Should show verification failed or error state
    const errorText = page.getByText(/verification failed|invalid/i);
    await expect(errorText.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show verification page with token', async ({ page }) => {
    await page.goto('/verify-email?token=test-token', { waitUntil: 'domcontentloaded' });

    // Should show verifying state or result (success/error depending on token validity)
    const verifying = page.getByText(/verifying|verification/i);
    await expect(verifying.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show Go to Login button on verification error', async ({ page }) => {
    // Mock failed verification
    await page.route('**/api/auth/verify-email', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid token' }),
      });
    });

    await page.goto('/verify-email?token=bad-token', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const loginButton = page.getByRole('link', { name: /go to login/i }).or(
      page.getByRole('button', { name: /go to login/i }),
    );
    await expect(loginButton.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Auth lifecycle — pending approval page', () => {
  test('should display pending approval heading', async ({ page }) => {
    // Create and login as pending user
    const email = uniqueEmail('pending-page');
    await withDatabase(async (pool) => {
      await pool.query(
        `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, 'Pending User', $1, 'member', true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET role = 'member', "emailVerified" = true`,
        [email],
      );
    });

    // Navigate directly since this user can't login normally
    await page.goto('/pending-approval', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/account pending approval/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display Check Status button', async ({ page }) => {
    await page.goto('/pending-approval', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /check status/i })).toBeVisible();
  });

  test('should display Log Out button', async ({ page }) => {
    await page.goto('/pending-approval', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
  });

  test('should display informational text about pending review', async ({ page }) => {
    await page.goto('/pending-approval', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/pending approval/i).first()).toBeVisible();
    await expect(page.getByText(/administrator will review/i)).toBeVisible();
  });
});

test.describe('Auth lifecycle — account rejected page', () => {
  test('should display account not approved heading', async ({ page }) => {
    await page.goto('/account-rejected', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/account not approved/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display registration not approved message', async ({ page }) => {
    await page.goto('/account-rejected', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/registration was not approved/i).first()).toBeVisible();
  });

  test('should display contact admin message', async ({ page }) => {
    await page.goto('/account-rejected', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/contact the platform administrator/i)).toBeVisible();
  });

  test('should display Log Out button', async ({ page }) => {
    await page.goto('/account-rejected', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
  });
});
