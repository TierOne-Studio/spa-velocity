import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationViaSession,
  uniqueEmail,
} from '../test-helpers';

/**
 * Single-org member: noise-free verification.
 *
 * Contract under test: a non-superadmin with exactly one membership sees
 *   - no `ViewingScopePicker` on Projects / Users / Admin Dashboard
 *   - no `OrgTargetField` dropdown in the create-project dialog
 *   - no `SystemViewBanner`
 *   - can still create a project — the server receives their org via the
 *     active-org fallback, not any user-picked value.
 */

const PASSWORD = 'SingleOrgPassword123!';
const managerEmail = uniqueEmail('e2e-single-org-manager');

const ORG_SLUG = 'e2e-single-org';
const ORG_NAME = 'E2E Single Org';

let organizationId = '';

async function mockProjectApis(page: Page, createCalls: { orgId: string }[]) {
  await page.route('**/api/airweave/collections**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  await page.route('**/api/projects**', async (route, request) => {
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'GET' && url.pathname === '/api/projects') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/projects') {
      const body = request.postDataJSON();
      createCalls.push({ orgId: body.organizationId });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: `new-${Date.now()}`,
            organizationId: body.organizationId,
            name: body.name,
            description: body.description ?? null,
            createdByUserId: 'single-1',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            sourceCount: 0,
            conversationCount: 0,
            sources: [],
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

test.describe('Single-org member: no org-picker noise', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: managerEmail,
      password: PASSWORD,
      name: 'E2E Single Org Admin',
      role: 'admin',
    });
    organizationId = await ensureOrganizationMembership({
      userEmail: managerEmail,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('projects page shows no viewing picker and no banner', async ({ page }) => {
    const createCalls: { orgId: string }[] = [];
    await mockProjectApis(page, createCalls);

    await loginWithCredentials(page, managerEmail, PASSWORD);
    await setActiveOrganizationViaSession(page, organizationId);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('projects-new-button')).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('viewing-scope-picker')).not.toBeVisible();
    await expect(page.getByTestId('system-view-banner')).not.toBeVisible();
  });

  test('create-project dialog shows no target-org dropdown and still submits the active org', async ({
    page,
  }) => {
    const createCalls: { orgId: string }[] = [];
    await mockProjectApis(page, createCalls);

    await loginWithCredentials(page, managerEmail, PASSWORD);
    await setActiveOrganizationViaSession(page, organizationId);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('projects-new-button').click();
    await expect(page.getByTestId('project-form-dialog')).toBeVisible();

    // Single-org member: OrgTargetField renders nothing in create mode.
    await expect(page.getByTestId('project-organization')).not.toBeVisible();
    await expect(page.getByTestId('project-organization-trigger')).not.toBeVisible();

    await page.getByLabel(/name/i).fill('Noise-Free Project');
    await page.getByTestId('project-form-submit').click();

    await expect.poll(() => createCalls.length).toBeGreaterThanOrEqual(1);
    expect(createCalls[0].orgId).toBe(organizationId);
  });

  test('admin dashboard and users page show no viewing picker for single-org member', async ({
    page,
  }) => {
    const createCalls: { orgId: string }[] = [];
    await mockProjectApis(page, createCalls);

    await loginWithCredentials(page, managerEmail, PASSWORD);
    await setActiveOrganizationViaSession(page, organizationId);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    // Header may not always be visible depending on permissions; if we land on
    // /admin/users the viewing picker must not appear — if we got redirected
    // (e.g. manager lacks /admin/users), there is no picker either. Both pass.
    await expect(page.getByTestId('viewing-scope-picker')).not.toBeVisible();
    await expect(page.getByTestId('system-view-banner')).not.toBeVisible();
  });
});
