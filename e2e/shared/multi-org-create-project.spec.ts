import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationViaSession,
  uniqueEmail,
} from '../test-helpers';

/**
 * Multi-org member: create-project target org via the shared `<OrgTargetField>`.
 *
 * Contract under test:
 *   - A multi-org member sees a target-org dropdown in the create dialog
 *     (previously they had no dropdown and were forced to sidebar-switch).
 *   - They can pick the non-active org and the created project carries that
 *     target org id — no sidebar active-org change required.
 */

const PASSWORD = 'MultiOrgPassword123!';
const memberEmail = uniqueEmail('e2e-multi-org-member');

const ORG_HOME_SLUG = 'e2e-multi-org-home';
const ORG_HOME_NAME = 'E2E Multi Home Org';
const ORG_TARGET_SLUG = 'e2e-multi-org-target';
const ORG_TARGET_NAME = 'E2E Multi Target Org';

let orgHomeId = '';
let orgTargetId = '';

async function mockProjectApis(page: Page, createCalls: { orgId: string; body: unknown }[]) {
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
      createCalls.push({ orgId: body.organizationId, body });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: `new-${Date.now()}`,
            organizationId: body.organizationId,
            name: body.name,
            description: body.description ?? null,
            createdByUserId: 'member-1',
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

test.describe('Multi-org create project via target field', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: memberEmail,
      password: PASSWORD,
      name: 'E2E Multi Org Member',
      role: 'admin',
    });

    orgHomeId = await ensureOrganizationMembership({
      userEmail: memberEmail,
      role: 'admin',
      orgSlug: ORG_HOME_SLUG,
      orgName: ORG_HOME_NAME,
    });
    orgTargetId = await ensureOrganizationMembership({
      userEmail: memberEmail,
      role: 'admin',
      orgSlug: ORG_TARGET_SLUG,
      orgName: ORG_TARGET_NAME,
    });
  });

  test('multi-org member picks a non-active target org without switching sidebar', async ({
    page,
  }) => {
    const createCalls: { orgId: string; body: unknown }[] = [];
    await mockProjectApis(page, createCalls);

    await loginWithCredentials(page, memberEmail, PASSWORD);
    await setActiveOrganizationViaSession(page, orgHomeId); // home org is active

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('projects-new-button')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('projects-new-button').click();
    await expect(page.getByTestId('project-form-dialog')).toBeVisible();

    // Target-org field is rendered for multi-org members.
    const targetField = page.getByTestId('project-organization');
    await expect(targetField).toBeVisible();

    // Pick the non-active target org via the dropdown.
    await page.getByTestId('project-organization-trigger').click();
    await page.getByRole('option', { name: new RegExp(ORG_TARGET_NAME, 'i') }).click();

    await page.getByLabel(/name/i).fill('Target-Org Project');
    await page.getByTestId('project-form-submit').click();

    await expect.poll(() => createCalls.length).toBeGreaterThanOrEqual(1);
    expect(createCalls[0].orgId).toBe(orgTargetId);
  });
});
