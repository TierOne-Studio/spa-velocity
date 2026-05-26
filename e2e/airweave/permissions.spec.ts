import { test, expect, type Page } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  setUserRole,
  ensureOrganizationForTestUser,
  login,
  setActiveOrganizationForUserSessions,
} from '../rbac-role-helpers';
import {
  installAirweaveMocks,
  newCalls,
  type AirweaveMockState,
} from './airweave-helpers';

/**
 * Verifies the Airweave UI honors the `airweave:*` permission gates:
 *   - admin sees Create + per-row Rename/Delete + Add source + Reauth
 *   - member sees read-only list (no Create, no row-actions, no Add source)
 *
 * Permissions in this SPA are driven by the user's `member.role` in the
 * active org via Better Auth. Setting the role at the DB level then
 * forcing the active-org cookie is the standard pattern used by
 * `e2e/rbac/*.spec.ts`. The Airweave backend calls are mocked so we
 * don't need an Airweave token in the test backend.
 */
const ADMIN_ORG_SLUG = 'e2e-airweave-perms-admin';
const ADMIN_ORG_NAME = 'E2E Airweave Perms Admin';
const MEMBER_ORG_SLUG = 'e2e-airweave-perms-member';
const MEMBER_ORG_NAME = 'E2E Airweave Perms Member';
const COLLECTION_READABLE_ID = 'e2e-perms-kb-abcdef00';

function mockState(orgId: string): AirweaveMockState {
  return {
    collections: [
      {
        id: 'col-1',
        name: 'Shared Collection',
        readableId: COLLECTION_READABLE_ID,
        organizationId: orgId,
        createdAt: '',
        updatedAt: '',
        status: 'active',
        sourceConnectionCount: 1,
      },
    ],
    sources: [
      {
        id: 'src-member-can-see',
        name: 'Read-only View',
        shortName: 'postgresql',
        collectionReadableId: COLLECTION_READABLE_ID,
        createdAt: '',
        updatedAt: '',
        isAuthenticated: true,
        entityCount: 7,
        authMethod: 'direct',
        status: 'active',
      },
    ],
    seq: 100,
  };
}

test.describe.serial('Airweave Permissions — admin vs member affordances', () => {
  let adminOrgId: string;
  let memberOrgId: string;

  test.beforeAll(async () => {
    const admin = await ensureOrganizationForTestUser({
      orgSlug: ADMIN_ORG_SLUG,
      orgName: ADMIN_ORG_NAME,
      memberRole: 'admin',
    });
    adminOrgId = admin.organizationId;
    const member = await ensureOrganizationForTestUser({
      orgSlug: MEMBER_ORG_SLUG,
      orgName: MEMBER_ORG_NAME,
      memberRole: 'member',
    });
    memberOrgId = member.organizationId;
  });

  test('admin sees Create + row-actions + Add source', async ({ page }) => {
    await setUserRole('admin'); // platform role; org role drives RBAC
    await installAirweaveMocks(page, mockState(adminOrgId), newCalls());

    await login(page);
    await setActiveOrganizationForUserSessions(adminOrgId);

    await page.goto('/admin/airweave');
    await expect(
      page.getByRole('heading', { name: /airweave collections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create collection/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /actions for shared collection/i }),
    ).toBeVisible();

    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    // ADR-011 § Amendment 4: primary CTA is "Connect a source"
    // (catalog widget); the legacy "Add direct source" stays for
    // advanced use. Asserting on the primary affordance is enough
    // to prove manage-sources permission carried through.
    await expect(
      page.getByRole('button', { name: /^connect a source$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^add direct source$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /collection actions/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /actions for read-only view/i }),
    ).toBeVisible();
  });

  test('member sees list but NO create / row-actions / add-source', async ({
    page,
  }) => {
    await setUserRole('member');
    await installAirweaveMocks(page, mockState(memberOrgId), newCalls());

    await login(page);
    await setActiveOrganizationForUserSessions(memberOrgId);

    await page.goto('/admin/airweave');
    await expect(
      page.getByRole('heading', { name: /airweave collections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Shared Collection', exact: true }),
    ).toBeVisible();

    // Affordances HIDDEN (not disabled) for member per convention
    await expect(
      page.getByRole('button', { name: /create collection/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /actions for shared collection/i }),
    ).toHaveCount(0);

    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    // Both source-add affordances hidden per Amendment 4 (member
    // lacks `airweave:manage-sources`).
    await expect(
      page.getByRole('button', { name: /^connect a source$/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^add direct source$/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /collection actions/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /actions for read-only view/i }),
    ).toHaveCount(0);

    // Read-only data IS visible (silent-filtered backend list)
    await expect(
      page.getByRole('cell', { name: 'Read-only View', exact: true }),
    ).toBeVisible();
  });
});
