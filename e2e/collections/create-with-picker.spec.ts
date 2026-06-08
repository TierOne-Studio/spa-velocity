import { test, expect, type Page } from '@playwright/test';

import {
  ensureOrganizationMembership,
  ensureUserWithRole,
  loginWithCredentials,
  setActiveOrganizationViaSession,
  uniqueEmail,
} from '../test-helpers';

/**
 * Multi-org member: create-collection target org via the shared
 * `<OrgTargetField>` (ADR-011 amendment 5/6). Mirrors the Projects picker
 * e2e (`e2e/shared/multi-org-create-project.spec.ts`).
 *
 * Contract under test (the NON-VACUOUS changed-selection assertion that the
 * jsdom component tests cannot make — Radix Select isn't drivable there):
 *   - A multi-org member sees the org dropdown in the create-collection dialog.
 *   - Picking the NON-active org makes the POST body carry that target org id
 *     — so the collection lands in the chosen org's allowlist, not the active
 *     org's.
 *
 * The API is mocked: this proves the frontend picker → request-body wiring.
 * The backend membership/superadmin enforcement is proven separately by the
 * api-velocity unit + integration specs.
 */

const PASSWORD = 'MultiOrgPassword123!';
const memberEmail = uniqueEmail('e2e-coll-picker');

const ORG_HOME_SLUG = 'e2e-coll-home';
const ORG_HOME_NAME = 'E2E Coll Home Org';
const ORG_TARGET_SLUG = 'e2e-coll-target';
const ORG_TARGET_NAME = 'E2E Coll Target Org';

let orgHomeId = '';
let orgTargetId = '';

async function mockCollectionApis(
  page: Page,
  createCalls: { organizationId: string | undefined; body: Record<string, unknown> }[],
) {
  // List + create share the `/api/airweave/collections` path — branch on method.
  await page.route('**/api/airweave/collections', async (route, request) => {
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      createCalls.push({ organizationId: body.organizationId as string | undefined, body });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: `new-${Date.now()}`,
            name: body.name,
            readableId: 'target-kb-abcd1234',
            organizationId: body.organizationId ?? null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            status: null,
            sourceConnectionCount: 0,
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  // Detail GET after the dialog navigates on success — keep it benign.
  await page.route('**/api/airweave/collections/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'new-x',
          name: 'Target KB',
          readableId: 'target-kb-abcd1234',
          organizationId: orgTargetId,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          status: null,
          sourceConnectionCount: 0,
          sourceConnections: [],
        },
      }),
    }),
  );
}

test.describe('Multi-org create collection via target field', () => {
  test.beforeAll(async () => {
    await ensureUserWithRole({
      email: memberEmail,
      password: PASSWORD,
      name: 'E2E Coll Picker Member',
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
    await mockCollectionApis(page, createCalls);

    await loginWithCredentials(page, memberEmail, PASSWORD);
    await setActiveOrganizationViaSession(page, orgHomeId); // home org active

    await page.goto('/collections', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: /create collection/i }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /create collection/i }).click();
    await expect(
      page.getByRole('heading', { name: /create airweave collection/i }),
    ).toBeVisible();

    // Picker is shown for a multi-org member; pick the NON-active target org.
    await expect(page.getByTestId('create-collection-org')).toBeVisible();
    await page.getByTestId('create-collection-org-trigger').click();
    await page
      .getByRole('option', { name: new RegExp(ORG_TARGET_NAME, 'i') })
      .click();

    await page.getByLabel(/^name$/i).fill('Target-Org KB');
    await page.getByRole('button', { name: /^create$/i }).click();

    await expect.poll(() => createCalls.length).toBeGreaterThanOrEqual(1);
    expect(createCalls[0].organizationId).toBe(orgTargetId);
  });
});
