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

const ORG_SLUG = 'e2e-airweave-srcdirect';
const ORG_NAME = 'E2E Airweave Direct Sources';
const COLLECTION_READABLE_ID = 'e2e-srcdirect-kb-12345678';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

function freshState(): AirweaveMockState {
  return {
    collections: [
      {
        id: 'col-1',
        name: 'Knowledge Base',
        readableId: COLLECTION_READABLE_ID,
        organizationId,
        createdAt: '',
        updatedAt: '',
        status: 'active',
        sourceConnectionCount: 0,
      },
    ],
    sources: [],
    seq: 10,
  };
}

test.describe('Airweave Source Connections — direct auth (admin)', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('creates a direct-auth source connection → POST with parsed credentials → row appears', async ({
    page,
  }) => {
    const calls = newCalls();
    const state = freshState();
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);

    await expect(
      page.getByRole('heading', { name: 'Knowledge Base' }),
    ).toBeVisible();
    await expect(
      page.getByText(/no source connections yet/i),
    ).toBeVisible();

    await page.getByRole('button', { name: /add source/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: /add source connection/i }),
    ).toBeVisible();

    // Direct tab is the default — fill it and submit.
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Production Postgres');
    await dialog.getByRole('textbox', { name: /source type/i }).fill('postgresql');
    await dialog
      .getByRole('textbox', { name: /credentials \(json\)/i })
      .fill('{"host":"db.example.com","user":"svc","password":"redacted"}');
    await dialog.getByRole('button', { name: /^create$/i }).click();

    await expect.poll(() => calls.createSource.length).toBe(1);
    const sent = calls.createSource[0];
    expect(sent.collectionReadableId).toBe(COLLECTION_READABLE_ID);
    expect(sent.body).toMatchObject({
      name: 'Production Postgres',
      shortName: 'postgresql',
      authentication: {
        kind: 'direct',
        credentials: {
          host: 'db.example.com',
          user: 'svc',
          password: 'redacted',
        },
      },
    });

    // Row appears with the new source
    await expect(
      page.getByRole('cell', { name: 'Production Postgres', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'postgresql' })).toBeVisible();
  });

  test('invalid JSON in credentials surfaces the inline alert + does NOT call backend', async ({
    page,
  }) => {
    const calls = newCalls();
    await installAirweaveMocks(page, freshState(), calls);

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page.getByRole('button', { name: /add source/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('textbox', { name: 'Name' }).fill('Pg');
    await dialog.getByRole('textbox', { name: /source type/i }).fill('postgresql');
    await dialog.getByRole('textbox', { name: /credentials \(json\)/i }).fill('not json');
    await dialog.getByRole('button', { name: /^create$/i }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/must be valid json/i);
    await expect(
      dialog.getByRole('textbox', { name: /credentials \(json\)/i }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(calls.createSource).toHaveLength(0);
  });

  test('deletes a source connection via row dropdown → DELETE sent → row gone', async ({
    page,
  }) => {
    const calls = newCalls();
    const state = freshState();
    state.sources.push({
      id: 'src-existing',
      name: 'Existing Source',
      shortName: 'postgresql',
      collectionReadableId: COLLECTION_READABLE_ID,
      createdAt: '',
      updatedAt: '',
      isAuthenticated: true,
      entityCount: 42,
      authMethod: 'direct',
      status: 'active',
    });
    await installAirweaveMocks(page, state, calls);

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await expect(
      page.getByRole('cell', { name: 'Existing Source', exact: true }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: /actions for existing source/i })
      .click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(
      deleteDialog.getByRole('heading', { name: /delete source connection/i }),
    ).toBeVisible();
    await deleteDialog.getByRole('button', { name: /^delete$/i }).click();

    await expect.poll(() => calls.deleteSource.length).toBe(1);
    expect(calls.deleteSource[0]).toBe('src-existing');
    await expect(
      page.getByRole('cell', { name: 'Existing Source', exact: true }),
    ).toHaveCount(0);
  });
});
