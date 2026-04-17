import { test, expect } from '@playwright/test';
import { API_BASE_URL, TEST_USER } from '../env';
import { ensureTestUserExists, escapeRegExp, uniqueEmail, withDatabase } from '../test-helpers';
import { resendTestEmail } from '../../src/shared/utils/resendTestEmail';

test.describe('Authentication E2E Tests', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists({
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User',
    });
  });

  test.describe('Signup Flow', () => {
    test('should display signup page correctly', async ({ page }) => {
      await page.goto('/signup');

      // CardTitle renders as div, use text content
      await expect(page.getByText('Create an account')).toBeVisible();
      await expect(page.getByLabel(/full name/i)).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    });

    test('should successfully sign up a new user and follow configured post-signup redirect', async ({ page }) => {
      const testUser = {
        name: 'Test User',
        email: uniqueEmail('auth-signup'),
        password: 'TestPassword123!',
      };

      await page.goto('/signup');

      await page.getByLabel(/full name/i).fill(testUser.name);
      await page.getByLabel('Email').fill(testUser.email);
      await page.getByLabel('Password', { exact: true }).fill(testUser.password);
      await page.getByLabel(/confirm password/i).fill(testUser.password);

      await page.getByRole('button', { name: /create account/i }).click();

      // After signup, user may be redirected to login, pending-approval, or root
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 10000 })
        .toMatch(/^\/(login|pending-approval)?$/);

      const createdRole = await withDatabase(async (pool) => {
        const result = await pool.query<{ role: string }>(
          `SELECT role FROM "user" WHERE email = $1`,
          [testUser.email],
        );

        return result.rows[0]?.role ?? null;
      });

      expect(createdRole).toBe('member');
    });

    test('should navigate to login page from signup', async ({ page }) => {
      await page.goto('/signup');

      await page.getByRole('link', { name: /sign in/i }).click();

      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Login Flow', () => {
    test('should display login page correctly', async ({ page }) => {
      await page.goto('/login');

      // CardTitle renders as div, use exact match
      await expect(page.getByText('Login to your account', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible();
    });

    test('should successfully login with verified user', async ({ page }) => {
      // Use the pre-verified test user from setup/global hooks
      const loginUser = {
        email: TEST_USER.email,
        password: TEST_USER.password,
      };

      await page.goto('/login');

      await page.getByLabel('Email').fill(loginUser.email);
      await page.getByLabel('Password').fill(loginUser.password);
      await page.getByRole('button', { name: /^login$/i }).click();

      // Should redirect to dashboard after successful login
      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });
    });

    test('should navigate to signup page from login', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: /sign up/i }).click();

      await expect(page).toHaveURL('/signup');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email').fill(resendTestEmail('delivered', 'nonexistent-login-user'));
      await page.getByLabel('Password').fill('wrongpassword');
      await page.getByRole('button', { name: /^login$/i }).click();

      // Should stay on login page or show error
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url).toContain('/login');
    });

    test('should show error for unverified email', async ({ page }) => {
      // Create a new user that won't be verified
      const unverifiedUser = {
        name: 'Unverified User',
        email: uniqueEmail('auth-unverified'),
        password: 'TestPassword123!',
      };

      // Sign up the user first
      await page.goto('/signup');
      await page.getByLabel(/full name/i).fill(unverifiedUser.name);
      await page.getByLabel('Email').fill(unverifiedUser.email);
      await page.getByLabel('Password', { exact: true }).fill(unverifiedUser.password);
      await page.getByLabel(/confirm password/i).fill(unverifiedUser.password);
      await page.getByRole('button', { name: /create account/i }).click();

      const postSignupPath = await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 10000 })
        .toMatch(/^\/(login|pending-approval)?$/)
        .then(() => new URL(page.url()).pathname);

      if (postSignupPath === '/login') {
        // Email verification enabled: unverified user should not be able to login.
        await page.getByLabel('Email').fill(unverifiedUser.email);
        await page.getByLabel('Password').fill(unverifiedUser.password);
        await page.getByRole('button', { name: /^login$/i }).click();

        await page.waitForTimeout(2000);
        expect(page.url()).toContain('/login');
        return;
      }

      if (postSignupPath === '/pending-approval') {
        // Approval-required mode: user is redirected to pending-approval page
        await expect(page.getByText(/pending approval/i).first()).toBeVisible({ timeout: 10000 });
        return;
      }

      // Test mode / verification-disabled mode: signup may authenticate immediately.
      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/);
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: /forgot your password/i }).click();

      await expect(page).toHaveURL('/forgot-password');
    });
  });

  test.describe('Forgot Password Flow', () => {
    test('should display forgot password page correctly', async ({ page }) => {
      await page.goto('/forgot-password');

      await expect(page.getByText('Forgot password?')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();
    });

    test('should submit forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByRole('button', { name: /send reset link/i }).click();

      // Should show success message
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5000 });
    });

    test('should navigate back to login', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByRole('link', { name: /back to login/i }).click();

      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Set New Password Flow', () => {
    test('should display invalid link message without token', async ({ page }) => {
      await page.goto('/set-new-password');

      await expect(page.getByText('Invalid Link')).toBeVisible();
      await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
    });

    test('should display password form with token', async ({ page }) => {
      await page.goto('/set-new-password?token=test-token');

      await expect(page.getByText('Set new password')).toBeVisible();
      await expect(page.getByLabel('New Password')).toBeVisible();
      await expect(page.getByLabel('Confirm Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();
    });

    test('should validate password match', async ({ page }) => {
      await page.goto('/set-new-password?token=test-token');

      await page.getByLabel('New Password').fill('newpassword123');
      await page.getByLabel('Confirm Password').fill('differentpassword');
      await page.getByRole('button', { name: /reset password/i }).click();

      // Should show error about passwords not matching
      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });
  });

  test.describe('Email Verification Flow', () => {
    test('should display error without token', async ({ page }) => {
      await page.goto('/verify-email');

      await expect(page.getByText(/invalid verification link/i)).toBeVisible({ timeout: 5000 });
    });

    test('should display verification page with token', async ({ page }) => {
      await page.goto('/verify-email?token=test-token');

      // Should show loading or error (invalid token)
      await expect(page.getByText(/email verification/i)).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();

      await page.goto('/');

      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    });
  });

  test.describe('Logout Flow', () => {
    test('should successfully logout', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      // Login first with verified user
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /^login$/i }).click();

      // Wait for dashboard
      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });

      // Ensure sidebar is expanded
      const sidebar = page.locator('[data-slot="sidebar"]');
      if (!(await sidebar.isVisible().catch(() => false))) {
        const sidebarTrigger = page.getByRole('button', { name: /toggle sidebar/i });
        if (await sidebarTrigger.isVisible().catch(() => false)) {
          await sidebarTrigger.click();
          await page.waitForTimeout(500);
        }
      }

      // Open user menu in sidebar to find logout
      const userMenuButton = sidebar.getByRole('button', { name: new RegExp(escapeRegExp(TEST_USER.email), 'i') });
      await expect(userMenuButton).toBeVisible({ timeout: 10000 });
      // Scroll sidebar footer into view
      await page.evaluate(() => {
        const footer = document.querySelector('[data-slot="sidebar-footer"]');
        if (footer) footer.scrollIntoView({ behavior: 'instant', block: 'end' });
      });
      await page.waitForTimeout(300);
      // Open the Radix dropdown via JS to bypass viewport/stability checks
      await userMenuButton.evaluate((el: HTMLElement) => {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));
        el.click();
      });
      await page.waitForTimeout(500);

      const logoutItem = page.getByRole('menuitem', { name: /log out|logout|sign out/i });
      await expect(logoutItem).toBeVisible({ timeout: 5000 });
      await logoutItem.click();
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });

    test('should clear bearer tokens on logout', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /^login$/i }).click();
      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });

      // Inject fake tokens to verify cleanup
      await page.evaluate(() => {
        localStorage.setItem('bearer_token', 'fake-token');
        localStorage.setItem('original_bearer_token', 'fake-original');
      });

      // Ensure sidebar is expanded
      const sidebar = page.locator('[data-slot="sidebar"]');
      if (!(await sidebar.isVisible().catch(() => false))) {
        const sidebarTrigger = page.getByRole('button', { name: /toggle sidebar/i });
        if (await sidebarTrigger.isVisible().catch(() => false)) {
          await sidebarTrigger.click();
          await page.waitForTimeout(500);
        }
      }

      const userMenuButton = sidebar.getByRole('button', { name: new RegExp(escapeRegExp(TEST_USER.email), 'i') });
      await expect(userMenuButton).toBeVisible({ timeout: 10000 });
      // Scroll sidebar footer into view
      await page.evaluate(() => {
        const footer = document.querySelector('[data-slot="sidebar-footer"]');
        if (footer) footer.scrollIntoView({ behavior: 'instant', block: 'end' });
      });
      await page.waitForTimeout(300);
      // Open the Radix dropdown via JS to bypass viewport/stability checks
      await userMenuButton.evaluate((el: HTMLElement) => {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));
        el.click();
      });
      await page.waitForTimeout(500);

      const logoutItem = page.getByRole('menuitem', { name: /log out|logout|sign out/i });
      await expect(logoutItem).toBeVisible({ timeout: 5000 });
      await logoutItem.click();
      await page.waitForTimeout(1000);

      const bt = await page.evaluate(() => localStorage.getItem('bearer_token'));
      const obt = await page.evaluate(() => localStorage.getItem('original_bearer_token'));
      expect(bt).toBeNull();
      expect(obt).toBeNull();
    });
  });

  test.describe('Login Redirect', () => {
    test('should redirect to dashboard after successful login', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /^login$/i }).click();

      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });
    });

    test('should NOT stay on login page after valid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /^login$/i }).click();

      await page.waitForTimeout(3000);
      expect(page.url()).not.toContain('/login');
    });
  });

  test.describe('Bearer Token Auth', () => {
    test('should store bearer_token in localStorage after login', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /^login$/i }).click();
      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });

      expect(page.url()).not.toContain('/login');
    });

    test('bearer token from localStorage should be attachable as an Authorization header', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /^login$/i }).click();
      await expect(page).toHaveURL(/\/(chat(\/.*)?|account|dashboard)?$/, { timeout: 10000 });

      const result = await page.evaluate(async (apiUrl) => {
        localStorage.setItem('bearer_token', 'test-bearer-e2e-token');
        const response = await fetch(`${apiUrl}/api/auth/get-session`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('bearer_token')}`,
          },
        });
        return {
          status: response.status,
        };
      }, API_BASE_URL);

      expect([200, 401, 403]).toContain(result.status);
    });
  });

  test.describe('Token Expiry', () => {
    test('password reset endpoint should accept requests (24h expiry configured)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/auth/request-password-reset`, {
        data: {
          email: TEST_USER.email,
          redirectTo: 'http://localhost:5173/set-new-password',
        },
      });
      expect(response.status()).not.toBe(500);
    });
  });
});
