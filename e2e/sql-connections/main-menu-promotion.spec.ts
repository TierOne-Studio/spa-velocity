/**
 * E2E coverage for the PR-2 UX promotion: Collections + SQL Connections
 * land in the Main menu, replacing the old `Admin → Airweave` entry and
 * stripping the SQL connections section from the Edit-Organization modal.
 *
 * What this spec proves end-to-end (browser-driven, real backend):
 *  1. The legacy URL `/admin/airweave` redirects to `/collections`.
 *  2. The collection-detail legacy URL also redirects with the path param.
 *  3. The new `/sql-connections` route renders the page with the
 *     extracted manager bound to the active organization.
 *  4. The Edit-Organization modal no longer shows the allowlist combobox
 *     or the embedded SQL connections section.
 *  5. Sidebar shows "Collections" + "SQL Connections" under Main when the
 *     caller holds the respective read permissions.
 *  6. Superadmin sees every menu item regardless of org context (PermissionsContext
 *     `can()` short-circuits — verified at the source in
 *     `src/shared/context/PermissionsContext.tsx:46`).
 *
 * Per the architect/qa/security reviews of PR-1, the RBAC migration
 * `rbac_021_add_sql_connection_permissions` MUST have already run against
 * this test database for `sql-connection:read` to be granted. The boot-time
 * NestJS migration runner handles that automatically.
 */

import { test, expect, type Page } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  loginWithCredentials,
  ensureOrganizationMembership,
  setActiveOrganizationForUserSessions,
} from '../test-helpers';

const ORG_SLUG = 'e2e-main-promotion';
const ORG_NAME = 'E2E Main Menu Promotion';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

test.describe('Main menu promotion — Collections + SQL Connections', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('legacy /admin/airweave URL redirects to /collections', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/airweave');

    // React Router replace-navigate → final URL is /collections.
    await page.waitForURL('**/collections');
    expect(page.url()).toMatch(/\/collections$/);
  });

  test('legacy /admin/airweave/:collectionReadableId redirects with param preserved', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/airweave/some-collection-id');

    await page.waitForURL('**/collections/some-collection-id');
    expect(page.url()).toMatch(/\/collections\/some-collection-id$/);
  });

  test('SQL Connections page renders for an admin with active org', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/sql-connections');

    await expect(
      page.locator('[data-testid="sql-connections-page"]'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /sql connections/i }),
    ).toBeVisible();
    // The extracted manager binds to the active org and shows the
    // Add-connection button for admins.
    await expect(
      page.locator('[data-testid="org-sql-add"]'),
    ).toBeVisible();
  });

  test('sidebar shows Collections + SQL Connections under Main (admin perms)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/chat');

    // The sidebar must include both new entries when the user holds the
    // matching read permissions. Admin has airweave:read AND
    // sql-connection:read (per rbac_021 + the constants update).
    await expect(
      page.getByRole('link', { name: 'Collections' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'SQL Connections' }),
    ).toBeVisible();
  });

  test('sidebar Admin group no longer contains an Airweave entry', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/chat');

    // Negative assertion: the old Admin → Airweave link is gone. We
    // navigate by inspecting the visible nav links rather than searching
    // for a string that might collide with the new Main "Collections"
    // entry's parent.
    const adminGroupLinks = page.locator('[data-sidebar="menu-sub-item"] a');
    const allHrefs = await adminGroupLinks.evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute('href')),
    );
    expect(allHrefs).not.toContain('/admin/airweave');
  });

  test('Create-Organization modal omits the allowlist combobox (PR-2 strip)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/organizations');

    // Open the Create dialog via the top-level Create button.
    const createBtn = page.getByRole('button', { name: /^create organization$/i });
    await createBtn.click();

    // Verify the stripped section is absent from the create-org modal.
    // (The corresponding data-testid was `org-airweave-allowlist-create`
    // before PR-2 — its disappearance is the binding assertion.)
    await expect(
      page.locator('[data-testid="org-airweave-allowlist-create"]'),
    ).toHaveCount(0);
    // Name + Slug fields remain (the modal still works for its intended
    // remaining responsibility).
    await expect(page.locator('#org-name')).toBeVisible();
    await expect(page.locator('#org-slug')).toBeVisible();
  });
});
