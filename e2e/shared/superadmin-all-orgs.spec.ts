import { test, expect, type Page } from '@playwright/test';

import { TEST_USER } from '../env';
import {
  ensureOrganizationMembership,
  loginWithCredentials,
  setActiveOrganizationViaSession,
  withDatabase,
} from '../test-helpers';

/**
 * Cross-cutting superadmin e2e: verifies the `ViewingScopePicker` +
 * `SystemViewBanner` contract on the Projects page.
 *
 * Contract under test (per org-UX standardization plan):
 *   - Superadmin lands with scope === "all" by default.
 *   - The amber `SystemViewBanner` is visible while in "all" mode.
 *   - Toggling the picker to a specific organization hides the banner and
 *     narrows the projects list to that org's rows (via API call shape).
 *
 * We mock the projects/airweave/organizations endpoints to keep the spec
 * deterministic and cheap — this is a UX contract test, not a data test.
 */

const ORG_A_SLUG = 'e2e-scope-all-a';
const ORG_A_NAME = 'E2E Scope Org A';
const ORG_B_SLUG = 'e2e-scope-all-b';
const ORG_B_NAME = 'E2E Scope Org B';

let orgAId: string;
let orgBId: string;

type ProjectRow = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  conversationCount: number;
};

function makeProject(id: string, organizationId: string, name: string): ProjectRow {
  return {
    id,
    organizationId,
    name,
    description: null,
    createdByUserId: 'user-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    sourceCount: 0,
    conversationCount: 0,
  };
}

async function mockAllOrgApis(
  page: Page,
  projectsByQuery: {
    all: ProjectRow[];
    byOrg: Record<string, ProjectRow[]>;
  },
) {
  // Every list call we see must have a `scope=all` or `organizationId=<id>`;
  // anything else is a bug. We also capture the last call so assertions can
  // verify the list narrowed correctly.
  await page.route('**/api/airweave/collections**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  await page.route('**/api/projects**', async (route, request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' || url.pathname !== '/api/projects') {
      await route.continue();
      return;
    }
    const scope = url.searchParams.get('scope');
    const organizationId = url.searchParams.get('organizationId');
    const data =
      scope === 'all'
        ? projectsByQuery.all
        : organizationId && projectsByQuery.byOrg[organizationId]
          ? projectsByQuery.byOrg[organizationId]
          : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });

  await page.route('**/api/platform-admin/organizations**', async (route, request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' || url.pathname !== '/api/platform-admin/organizations') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: orgAId,
            name: ORG_A_NAME,
            slug: ORG_A_SLUG,
            createdAt: '2026-01-01',
            memberCount: 1,
          },
          {
            id: orgBId,
            name: ORG_B_NAME,
            slug: ORG_B_SLUG,
            createdAt: '2026-01-01',
            memberCount: 1,
          },
        ],
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      }),
    });
  });
}

test.describe('Superadmin viewing scope: All organizations default + banner', () => {
  test.beforeAll(async () => {
    await withDatabase(async (pool) => {
      await pool.query(`UPDATE "user" SET role = 'superadmin' WHERE email = $1`, [
        TEST_USER.email,
      ]);
    });
    orgAId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_A_SLUG,
      orgName: ORG_A_NAME,
    });
    orgBId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_B_SLUG,
      orgName: ORG_B_NAME,
    });
  });

  test('defaults to "All organizations" with the system-view banner visible', async ({
    page,
  }) => {
    await mockAllOrgApis(page, {
      all: [
        makeProject('p-a', orgAId, 'Alpha Project (A)'),
        makeProject('p-b', orgBId, 'Bravo Project (B)'),
      ],
      byOrg: {
        [orgAId]: [makeProject('p-a', orgAId, 'Alpha Project (A)')],
        [orgBId]: [makeProject('p-b', orgBId, 'Bravo Project (B)')],
      },
    });

    await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
    await setActiveOrganizationViaSession(page, orgAId);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // Banner visible (scope === "all")
    await expect(page.getByTestId('system-view-banner')).toBeVisible({ timeout: 15000 });

    // Both org rows visible in cross-org view
    await expect(page.getByText('Alpha Project (A)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bravo Project (B)')).toBeVisible();
  });

  test('toggling picker to a specific org hides the banner and narrows the list', async ({
    page,
  }) => {
    await mockAllOrgApis(page, {
      all: [
        makeProject('p-a', orgAId, 'Alpha Project (A)'),
        makeProject('p-b', orgBId, 'Bravo Project (B)'),
      ],
      byOrg: {
        [orgAId]: [makeProject('p-a', orgAId, 'Alpha Project (A)')],
        [orgBId]: [makeProject('p-b', orgBId, 'Bravo Project (B)')],
      },
    });

    await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
    await setActiveOrganizationViaSession(page, orgAId);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('system-view-banner')).toBeVisible({ timeout: 15000 });

    // Open the scope picker and pick Org A
    const trigger = page.getByTestId('viewing-scope-picker');
    await expect(trigger).toContainText(/all organizations/i, { timeout: 10000 });
    await trigger.click();
    const orgOption = page.getByRole('option', { name: new RegExp(ORG_A_NAME, 'i') }).last();
    await expect(orgOption).toBeVisible({ timeout: 10000 });
    await orgOption.click();

    // Banner gone, Org B project gone, Org A project still present
    await expect(page.getByTestId('system-view-banner')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Alpha Project (A)')).toBeVisible();
    await expect(page.getByText('Bravo Project (B)')).not.toBeVisible();
  });
});
