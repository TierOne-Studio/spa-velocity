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
 * Pins the Reauth row-action contract.
 *
 * The wrapper hook (`useAirweaveConnectModal`) calls `getSessionToken`
 * inside the SDK's `open()` — which in turn invokes the reauth mutation
 * and returns the fresh token to the SDK. Our e2e proves the SPA wire:
 *   - menu item visibility filter (oauth_browser only)
 *   - click triggers `connectModal.open()`
 *   - `getSessionToken` callback fires POST /reauth
 *
 * The SDK iframe handshake itself is mocked at the suite level (see
 * src/test/setup.ts pattern carried by the Vite alias to our shim).
 */
const ORG_SLUG = 'e2e-airweave-reauth';
const ORG_NAME = 'E2E Airweave Reauth';
const COLLECTION_READABLE_ID = 'e2e-reauth-kb-aabbccdd';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

function stateWith(sources: AirweaveMockState['sources']): AirweaveMockState {
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
        sourceConnectionCount: sources.length,
      },
    ],
    sources,
    seq: 50,
  };
}

test.describe('Airweave Reauth — row action (admin)', () => {
  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test('OAuth source row → row dropdown shows Re-authenticate menu item', async ({
    page,
  }) => {
    await installAirweaveMocks(
      page,
      stateWith([
        {
          id: 'src-oauth',
          name: 'Acme Slack',
          shortName: 'slack',
          airweaveCollectionReadableId: COLLECTION_READABLE_ID,
          createdAt: '',
          updatedAt: '',
          isAuthenticated: true,
          entityCount: 100,
          authMethod: 'oauth_browser',
          status: 'active',
        },
      ]),
      newCalls(),
    );

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await expect(
      page.getByRole('cell', { name: 'Acme Slack', exact: true }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: /actions for acme slack/i })
      .click();
    await expect(
      page.getByRole('menuitem', { name: /re-authenticate/i }),
    ).toBeVisible();
  });

  test('direct-auth source row → row dropdown does NOT show Re-authenticate', async ({
    page,
  }) => {
    await installAirweaveMocks(
      page,
      stateWith([
        {
          id: 'src-direct',
          name: 'Production Postgres',
          shortName: 'postgresql',
          airweaveCollectionReadableId: COLLECTION_READABLE_ID,
          createdAt: '',
          updatedAt: '',
          isAuthenticated: true,
          entityCount: 42,
          authMethod: 'direct',
          status: 'active',
        },
      ]),
      newCalls(),
    );

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page
      .getByRole('button', { name: /actions for production postgres/i })
      .click();

    // Rename + Delete are present; Re-authenticate is filtered out.
    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete/i })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: /re-authenticate/i }),
    ).toHaveCount(0);
  });

  test('click Re-authenticate → fires POST /reauth with the source id', async ({
    page,
  }) => {
    const calls = newCalls();
    await installAirweaveMocks(
      page,
      stateWith([
        {
          id: 'src-reauth-target',
          name: 'Acme Notion',
          shortName: 'notion',
          airweaveCollectionReadableId: COLLECTION_READABLE_ID,
          createdAt: '',
          updatedAt: '',
          isAuthenticated: false,
          entityCount: 0,
          authMethod: 'oauth_browser',
          status: 'error',
        },
      ]),
      calls,
    );

    await loginAsAdmin(page);
    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page
      .getByRole('button', { name: /actions for acme notion/i })
      .click();
    await page.getByRole('menuitem', { name: /re-authenticate/i }).click();

    // Wrapper hook's getSessionToken fires the reauth POST on SDK open().
    // With the SDK shimmed at the module level, open() resolves to a
    // no-op — but getSessionToken still runs the mutation.
    await expect.poll(() => calls.reauthSource.length).toBeGreaterThan(0);
    expect(calls.reauthSource[0]).toBe('src-reauth-target');
  });
});
