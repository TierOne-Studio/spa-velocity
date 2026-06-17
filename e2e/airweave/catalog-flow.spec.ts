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
  type AirweaveMockCalls,
} from './airweave-helpers';

/**
 * Pins the **catalog-button** primary OAuth flow per ADR-011 § Amendment 4.
 *
 * Replaces the deleted `oauth-flow.spec.ts` which validated the
 * pre-Amendment-4 dialog → onOAuthSubmit → page-level ref-mirror path
 * (that whole architecture is gone). The current flow is:
 *
 *   user clicks "Connect a source" on the detail page
 *     ↓
 *   page invokes `useAirweaveConnectModal.open()`
 *     ↓
 *   SDK calls our `getSessionToken` callback
 *     ↓
 *   callback POSTs /api/airweave/connect/session  {airweaveCollectionId}
 *     ↓
 *   backend returns {sessionToken}
 *     ↓
 *   SDK opens its iframe at connect.airweave.ai
 *
 * Only the SPA-side wire is validated here (mocked backend). The full
 * iframe handshake against real Airweave lives in `airweave-live.spec.ts`
 * — that test needs `AIRWEAVE_API_KEY` and won't run in CI without
 * secrets. This mocked test runs every PR in <3s, catches SPA-side
 * regressions (wrong endpoint, wrong body shape, broken theme prop,
 * missing button) immediately.
 */
const ORG_SLUG = 'e2e-airweave-catalog';
const ORG_NAME = 'E2E Airweave Catalog';
const COLLECTION_READABLE_ID = 'e2e-catalog-kb-deadbeef';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

function baseState(): AirweaveMockState {
  return {
    collections: [
      {
        id: 'col-cat-1',
        name: 'Catalog Test KB',
        readableId: COLLECTION_READABLE_ID,
        organizationId,
        createdAt: '',
        updatedAt: '',
        status: 'active',
        sourceConnectionCount: 0,
      },
    ],
    sources: [],
    seq: 100,
  };
}

/**
 * Block outbound requests to connect.airweave.ai so the SDK's iframe
 * doesn't try to load the real widget during a mocked test. The widget
 * itself isn't what we're validating — the SPA's POST + button + theme
 * wiring is. Without this block, headless Chromium would wait on a
 * cross-origin request that never resolves under our mocked harness.
 */
async function blockSdkIframe(page: Page): Promise<void> {
  await page.route('**/connect.airweave.ai/**', (route) => route.abort());
}

test.describe('Airweave Catalog widget — primary OAuth flow (admin)', () => {
  let calls: AirweaveMockCalls;

  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test.beforeEach(() => {
    calls = newCalls();
  });

  test('"Connect a source" button is visible to admin on the detail page', async ({
    page,
  }) => {
    await installAirweaveMocks(page, baseState(), calls);
    await blockSdkIframe(page);
    await loginAsAdmin(page);

    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await expect(
      page.getByRole('button', { name: /^connect a source$/i }),
    ).toBeVisible();
    // Secondary affordance for advanced users (direct creds) — must
    // coexist per Amendment 4 toolbar layout.
    await expect(
      page.getByRole('button', { name: /^add direct source$/i }),
    ).toBeVisible();
  });

  test('clicking "Connect a source" POSTs /api/airweave/connect/session with the right airweaveCollectionId', async ({
    page,
  }) => {
    await installAirweaveMocks(page, baseState(), calls);
    await blockSdkIframe(page);
    await loginAsAdmin(page);

    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page
      .getByRole('button', { name: /^connect a source$/i })
      .click();

    // Poll until the SPA's getSessionToken closure fires the POST.
    // `open()` is async (the SDK awaits getSessionToken inside) so
    // direct toHaveLength assertion would race the resolution.
    await expect
      .poll(() => calls.connectSession.length, { timeout: 5000 })
      .toBeGreaterThanOrEqual(1);

    expect(calls.connectSession[0]).toEqual({
      airweaveCollectionId: COLLECTION_READABLE_ID,
    });
  });

  // The "two clicks fire two POSTs (no caching)" assertion is
  // already pinned by the page-level unit test in
  // AirweaveCollectionDetailPage.test.tsx ("getSessionToken fetches
  // a fresh token from POST /api/airweave/connect/session each call").
  // E2e is the wrong layer for it — the SDK's portal overlay blocks
  // subsequent button clicks once opened, making the test flaky for
  // no marginal coverage gain. Unit test is the regression guard.

  test('"Add direct source" still opens the legacy dialog (Amendment 4 keeps direct-auth as advanced path)', async ({
    page,
  }) => {
    await installAirweaveMocks(page, baseState(), calls);
    await blockSdkIframe(page);
    await loginAsAdmin(page);

    await page.goto(`/admin/airweave/${COLLECTION_READABLE_ID}`);
    await page
      .getByRole('button', { name: /^add direct source$/i })
      .click();

    // The dialog title surfaces the Amendment-4 framing — "direct"
    // is the explicit modifier so users don't expect OAuth.
    await expect(
      page.getByRole('heading', { name: /add direct source connection/i }),
    ).toBeVisible();
    // The OAuth tab is gone — only the direct form should be there.
    await expect(
      page.getByRole('tab', { name: /^oauth$/i }),
    ).toHaveCount(0);
    // No POST to connect-session from this path.
    expect(calls.connectSession).toEqual([]);
  });
});
