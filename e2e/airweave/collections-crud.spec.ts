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

const ORG_SLUG = 'e2e-airweave-crud';
const ORG_NAME = 'E2E Airweave CRUD';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

test.describe('Airweave Collections — CRUD (admin)', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('lists existing collections + shows Create button for admin', async ({
    page,
  }) => {
    const state: AirweaveMockState = {
      collections: [
        {
          id: 'col-1',
          name: 'Knowledge Base',
          readableId: 'e2e-airweave-crud-kb-deadbeef',
          organizationId,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
          status: 'active',
          sourceConnectionCount: 3,
        },
      ],
      sources: [],
      seq: 1,
    };
    await installAirweaveMocks(page, state, newCalls());

    await loginAsAdmin(page);
    await page.goto('/admin/airweave');

    await expect(
      page.getByRole('heading', { name: /airweave collections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create collection/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Knowledge Base', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'e2e-airweave-crud-kb-deadbeef' }),
    ).toBeVisible();
  });

  test('creates a new collection → POST sent → row appears → navigates to detail', async ({
    page,
  }) => {
    const calls = newCalls();
    const state: AirweaveMockState = {
      collections: [],
      sources: [],
      seq: 0,
    };
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto('/admin/airweave');

    await page.getByRole('button', { name: /create collection/i }).click();
    const createDialog = page.getByRole('dialog');
    await expect(
      createDialog.getByRole('heading', { name: /create airweave collection/i }),
    ).toBeVisible();

    await createDialog.getByRole('textbox', { name: 'Name' }).fill('Customer Support');
    await createDialog.getByRole('textbox', { name: /slug hint/i }).fill('support');
    await createDialog.getByRole('button', { name: /^create$/i }).click();

    // Wire-shape assertion: SPA sent the right body
    await expect.poll(() => calls.createCollection.length).toBeGreaterThan(0);
    expect(calls.createCollection[0]).toEqual({
      name: 'Customer Support',
      slugHint: 'support',
    });

    // Navigation: detail route mounted
    await page.waitForURL(/\/admin\/airweave\/support-/);
    await expect(
      page.getByRole('heading', { name: 'Customer Support' }),
    ).toBeVisible();
  });

  test('renames a collection via the row dropdown → PATCH sent → name updates', async ({
    page,
  }) => {
    const calls = newCalls();
    const state: AirweaveMockState = {
      collections: [
        {
          id: 'col-2',
          name: 'Old Name',
          readableId: 'e2e-airweave-crud-rename-cafebabe',
          organizationId,
          createdAt: '',
          updatedAt: '',
          status: 'active',
          sourceConnectionCount: 0,
        },
      ],
      sources: [],
      seq: 2,
    };
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto('/admin/airweave');
    await expect(page.getByRole('cell', { name: 'Old Name', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /actions for old name/i }).click();
    await page.getByRole('menuitem', { name: /rename/i }).click();

    const renameDialog = page.getByRole('dialog');
    await expect(
      renameDialog.getByRole('heading', { name: /rename collection/i }),
    ).toBeVisible();
    await renameDialog.getByRole('textbox', { name: 'Name' }).fill('Renamed Collection');
    await renameDialog.getByRole('button', { name: /^save$/i }).click();

    await expect.poll(() => calls.patchCollection.length).toBeGreaterThan(0);
    expect(calls.patchCollection[0].body).toMatchObject({
      name: 'Renamed Collection',
    });
    await expect(
      page.getByRole('cell', { name: 'Renamed Collection', exact: true }),
    ).toBeVisible();
  });

  test('deletes a collection via confirm dialog → DELETE sent → row gone', async ({
    page,
  }) => {
    const calls = newCalls();
    const state: AirweaveMockState = {
      collections: [
        {
          id: 'col-3',
          name: 'Doomed Collection',
          readableId: 'e2e-airweave-crud-doomed-feedface',
          organizationId,
          createdAt: '',
          updatedAt: '',
          status: 'active',
          sourceConnectionCount: 0,
        },
      ],
      sources: [],
      seq: 3,
    };
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto('/admin/airweave');
    await expect(
      page.getByRole('cell', { name: 'Doomed Collection', exact: true }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: /actions for doomed collection/i })
      .click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(
      deleteDialog.getByRole('heading', { name: /delete collection/i }),
    ).toBeVisible();
    await deleteDialog.getByRole('button', { name: /^delete$/i }).click();

    await expect.poll(() => calls.deleteCollection.length).toBe(1);
    expect(calls.deleteCollection[0]).toBe(
      'e2e-airweave-crud-doomed-feedface',
    );
    await expect(
      page.getByRole('cell', { name: 'Doomed Collection', exact: true }),
    ).toHaveCount(0);
  });
});
