import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import {
  ensureOrganizationMembership,
  loginWithCredentials,
  setActiveOrganizationForUserSessions,
  withDatabase,
} from '../test-helpers';

const ORG_SLUG = 'e2e-projects-perms';
const ORG_NAME = 'E2E Projects Perms';

let organizationId: string;

async function loginAndSetOrg(page: Page) {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

async function mockEmptyProjects(page: Page) {
  await page.route('**/api/projects**', async (route, request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/projects') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe('Projects permissions', () => {
  test.beforeAll(async () => {
    await withDatabase(async (pool) => {
      await pool.query(`UPDATE "user" SET role = 'superadmin' WHERE email = $1`, [TEST_USER.email]);
    });
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('superadmin sees the New project button', async ({ page }) => {
    await mockEmptyProjects(page);
    await loginAndSetOrg(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('projects-new-button')).toBeVisible({ timeout: 15000 });
  });

  test('Projects nav link is present in the sidebar', async ({ page }) => {
    await mockEmptyProjects(page);
    await loginAndSetOrg(page);
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // The nav link to /projects should be visible in the header/nav
    const projectsLink = page.getByRole('link', { name: /^projects$/i }).first();
    await expect(projectsLink).toBeVisible({ timeout: 15000 });
  });
});
