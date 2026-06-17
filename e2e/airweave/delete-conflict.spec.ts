import { test, expect, type Page } from '@playwright/test';
import { TEST_USER } from '../env';
import {
  loginWithCredentials,
  ensureOrganizationMembership,
  setActiveOrganizationForUserSessions,
} from '../test-helpers';
import {
  installAirweaveMocks,
  newCalls,
  type AirweaveMockState,
} from './airweave-helpers';

/**
 * Pins the `DeleteAirweaveCollectionDialog` 409 → "Collection in use" flow.
 *
 * When the backend rejects a delete because the collection is referenced
 * by one or more projects (`{message, projects: [{id, name}]}` payload
 * per ADR-011 § Decision 11), the dialog flips from "Confirm delete"
 * state to a second screen listing the project names with deep links so
 * the user can go detach the source. The collection itself is NOT
 * deleted; the row remains in the list.
 */
const ORG_SLUG = 'e2e-airweave-409';
const ORG_NAME = 'E2E Airweave 409 in-use';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

test.describe('Airweave Collections — delete 409 in-use flow', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('DELETE returns 409 with referencing projects → dialog flips to in-use screen + row stays', async ({
    page,
  }) => {
    const calls = newCalls();
    const conflictedReadableId = 'e2e-409-pinned-deadbeef';
    const state: AirweaveMockState = {
      collections: [
        {
          id: 'col-pinned',
          name: 'Pinned Collection',
          readableId: conflictedReadableId,
          organizationId,
          createdAt: '',
          updatedAt: '',
          status: 'active',
          sourceConnectionCount: 0,
        },
      ],
      sources: [],
      seq: 60,
      deleteCollectionConflicts: {
        [conflictedReadableId]: [
          { id: 'proj-alpha', name: 'Alpha Project' },
          { id: 'proj-beta', name: 'Beta Project' },
        ],
      },
    };
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto('/admin/airweave');

    // Open Delete confirm dialog from row dropdown
    await page
      .getByRole('button', { name: /actions for pinned collection/i })
      .click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(
      deleteDialog.getByRole('heading', { name: /delete airweave collection/i }),
    ).toBeVisible();
    await deleteDialog.getByRole('button', { name: /^delete$/i }).click();

    // DELETE goes out; backend returns 409 → dialog flips to in-use screen
    await expect.poll(() => calls.deleteCollection.length).toBe(1);
    await expect(
      deleteDialog.getByRole('heading', { name: /airweave collection in use/i }),
    ).toBeVisible();

    // Both referencing projects are listed
    await expect(deleteDialog.getByText('Alpha Project')).toBeVisible();
    await expect(deleteDialog.getByText('Beta Project')).toBeVisible();

    // Each project has an "Open" deep link to the project page
    const alphaOpen = deleteDialog
      .locator('li')
      .filter({ hasText: 'Alpha Project' })
      .getByRole('link', { name: /open/i });
    await expect(alphaOpen).toHaveAttribute(
      'href',
      '/admin/projects/proj-alpha',
    );

    // The collection itself was NOT removed from the list
    // Two "Close" buttons in the dialog: the form's explicit Close (text)
    // and the dialog chrome's X corner button (also accessibly named Close).
    // Use .first() to pick the form button — clicking either dismisses the
    // dialog the same way, but .first() makes the intent explicit.
    await deleteDialog.getByRole('button', { name: /^close$/i }).first().click();
    await expect(
      page.getByRole('cell', { name: 'Pinned Collection', exact: true }),
    ).toBeVisible();
  });

  test('successful delete (no conflict) still removes the row — regression pin for the happy path', async ({
    page,
  }) => {
    const calls = newCalls();
    const state: AirweaveMockState = {
      collections: [
        {
          id: 'col-clean',
          name: 'Removable Collection',
          readableId: 'e2e-409-removable-cafebabe',
          organizationId,
          createdAt: '',
          updatedAt: '',
          status: 'active',
          sourceConnectionCount: 0,
        },
      ],
      sources: [],
      seq: 70,
      // no deleteCollectionConflicts → 204 path
    };
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto('/admin/airweave');
    await page
      .getByRole('button', { name: /actions for removable collection/i })
      .click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const deleteDialog = page.getByRole('dialog');
    await deleteDialog.getByRole('button', { name: /^delete$/i }).click();

    await expect.poll(() => calls.deleteCollection.length).toBe(1);
    await expect(
      page.getByRole('cell', { name: 'Removable Collection', exact: true }),
    ).toHaveCount(0);
  });
});
