import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationViaSession,
  uniqueEmail,
} from '../test-helpers';

/**
 * Multi-org member: create-SQL-connection target org via `<OrgTargetField>`
 * (ADR-011 amendment 5/6). The SQL dialog has its own wiring vs Collections:
 * the create button is gated on a successful connectivity test, and the
 * owning org is resolved by the manager as `payload.organizationId ?? active`.
 *
 * Contract under test (non-vacuous changed-selection — Radix isn't drivable
 * in jsdom): a multi-org member picks the NON-active org, tests, submits, and
 * the create POST carries the chosen org id (not the active org).
 *
 * API is mocked: proves the frontend picker → request-body wiring.
 */

const PASSWORD = 'MultiOrgPassword123!';
const memberEmail = uniqueEmail('e2e-sql-picker');

const ORG_HOME_SLUG = 'e2e-sql-home';
const ORG_HOME_NAME = 'E2E Sql Home Org';
const ORG_TARGET_SLUG = 'e2e-sql-target';
const ORG_TARGET_NAME = 'E2E Sql Target Org';

let orgHomeId = '';
let orgTargetId = '';

async function mockSqlApis(
  page: Page,
  createCalls: { organizationId: string | undefined; body: Record<string, unknown> }[],
) {
  // The credential-test endpoint (`/api/sql-connections/test`) must be matched
  // BEFORE the generic create route, so register the more specific one first.
  await page.route('**/api/sql-connections/test**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  await page.route('**/api/sql-connections**', async (route, request) => {
    const url = new URL(request.url());
    // Don't hijack the /test path handled above.
    if (url.pathname.endsWith('/test')) {
      await route.fallback();
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      createCalls.push({ organizationId: body.organizationId as string | undefined, body });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: `sc-${Date.now()}`,
            organizationId: body.organizationId ?? null,
            name: body.name,
            host: body.host,
            port: body.port,
            database: body.database,
            username: body.username,
            ssl: body.ssl ?? false,
            schemaName: body.schemaName ?? 'public',
            status: 'ready',
            statusError: null,
          },
        }),
      });
      return;
    }
    // GET list
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
}

test.describe('Multi-org create SQL connection via target field', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: memberEmail,
      password: PASSWORD,
      name: 'E2E Sql Picker Member',
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

  test('multi-org member picks a non-active target org; the create POST carries it', async ({
    page,
  }) => {
    const createCalls: { organizationId: string | undefined; body: Record<string, unknown> }[] = [];
    await mockSqlApis(page, createCalls);

    await loginWithCredentials(page, memberEmail, PASSWORD);
    await setActiveOrganizationViaSession(page, orgHomeId); // home org active

    await page.goto('/sql-connections', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('org-sql-add')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('org-sql-add').click();

    // Picker shown for a multi-org member; pick the NON-active target org.
    await expect(page.getByTestId('sql-conn-org')).toBeVisible();
    await page.getByTestId('sql-conn-org-trigger').click();
    await page
      .getByRole('option', { name: new RegExp(ORG_TARGET_NAME, 'i') })
      .click();

    await page.getByTestId('sql-conn-name').fill('Target Reporting DB');
    await page.getByTestId('sql-conn-host').fill('db.example.com');
    await page.getByTestId('sql-conn-database').fill('reporting');
    await page.getByTestId('sql-conn-username').fill('reader');
    await page.getByTestId('sql-conn-password').fill('typed-secret');

    // Submit is gated on a successful test first.
    await page.getByTestId('sql-conn-test').click();
    await expect(page.getByTestId('sql-conn-submit')).toBeEnabled({ timeout: 10000 });
    await page.getByTestId('sql-conn-submit').click();

    await expect.poll(() => createCalls.length).toBeGreaterThanOrEqual(1);
    expect(createCalls[0].organizationId).toBe(orgTargetId);
  });
});
