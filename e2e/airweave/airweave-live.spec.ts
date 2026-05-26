import { test, expect, type Page } from '@playwright/test';
import { API_BASE_URL, TEST_USER } from '../env';
import {
  loginWithCredentials,
  ensureOrganizationMembership,
  setActiveOrganizationForUserSessions,
} from '../test-helpers';

/**
 * Live end-to-end smoke against the REAL Airweave API.
 *
 * `.env.test` carries a working `AIRWEAVE_API_KEY` (shared team
 * account). When the e2e backend boots with that env file, every
 * proxied call hits the live Airweave API at https://api.airweave.ai.
 * The SPA's SDK fallback URL (`https://connect.airweave.ai`) is used
 * for the OAuth widget when `VITE_AIRWEAVE_CONNECT_URL` is unset.
 *
 * What this validates that the mocked specs and the
 * /api/airweave/collections/<seeded> smoke (`integration-smoke.spec.ts`)
 * cannot:
 *
 *   1. POST /api/airweave/collections actually creates a real
 *      collection in Airweave AND adds its readable_id to the org's
 *      allowlist atomically.
 *   2. The CSPRNG-random `readable_id` suffix (ADR-011 Amendment 1)
 *      survives the upstream round-trip.
 *   3. LIST page returns the freshly-created collection (proves the
 *      silent-filter against the allowlist works against real data).
 *   4. DETAIL page returns 200 with the upstream payload (proves the
 *      ownership guard + downstream fetch chain works with real creds).
 *   5. The OAuth create endpoint actually returns a usable sessionToken
 *      from `POST /api/airweave/connect/session` (proves the SDK
 *      handoff payload is intact end-to-end — the only thing that's
 *      NOT validated here is the human-driven OAuth handshake on the
 *      upstream provider's page, which requires a real Slack/Notion
 *      workspace).
 *   6. DELETE actually removes the collection from Airweave AND from
 *      the org's allowlist — proves cleanup is honest.
 *
 * SHARED-ACCOUNT HYGIENE:
 * Each test creates uniquely-named collections (timestamp + random
 * suffix) and unconditionally cleans them up in `afterEach` — even on
 * spec failure. If a test panic leaks a row, the upstream readable_id
 * still has `e2e-live-` prefix so it's recoverable via Airweave's
 * dashboard with a single filter.
 */
const ORG_SLUG = 'e2e-airweave-live';
const ORG_NAME = 'E2E Airweave Live';

let organizationId: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, TEST_USER.email, TEST_USER.password);
  await setActiveOrganizationForUserSessions({
    userEmail: TEST_USER.email,
    organizationId,
  });
}

/**
 * Grab the better-auth bearer token from the page's localStorage so we
 * can make authenticated API calls outside the React render tree
 * (cleanup paths, direct assertions).
 */
async function getBearer(page: Page): Promise<string> {
  const token = await page.evaluate(() =>
    window.localStorage.getItem('bearer_token'),
  );
  if (!token) throw new Error('No bearer token in localStorage after login');
  return token;
}

/** Created collections this test should delete on teardown. */
type CleanupHandle = { readableId: string };

test.describe('Airweave — LIVE Airweave API + LIVE backend + LIVE Postgres', () => {
  let createdInTest: CleanupHandle[] = [];

  test.beforeAll(async () => {
    organizationId = await ensureOrganizationMembership({
      userEmail: TEST_USER.email,
      role: 'admin',
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
  });

  test.afterEach(async ({ page }) => {
    if (createdInTest.length === 0) return;
    // Fresh bearer — login state may have been cleared by clearAuthState
    // in the next test's loginWithCredentials, so use whatever we have
    // right now. Best-effort cleanup; we'd rather leak a row than mask
    // a real test failure.
    let token: string | null = null;
    try {
      token = await page.evaluate(() =>
        window.localStorage.getItem('bearer_token'),
      );
    } catch {
      // page may have been closed by the test runner already
    }
    if (!token) {
      console.warn(
        `[airweave-live] Skipping cleanup — no bearer available. Leaked: ${createdInTest
          .map((c) => c.readableId)
          .join(', ')}`,
      );
      createdInTest = [];
      return;
    }
    for (const { readableId } of createdInTest) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(readableId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok && res.status !== 404) {
          console.warn(
            `[airweave-live] Cleanup DELETE ${readableId} → ${res.status}`,
          );
        }
      } catch (err) {
        console.warn(`[airweave-live] Cleanup error for ${readableId}:`, err);
      }
    }
    createdInTest = [];
  });

  test('create → LIST shows it → DETAIL returns 200 → DELETE removes it (admin, no mocks)', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const token = await getBearer(page);

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const displayName = `E2E Live ${suffix}`;
    const slugHint = `e2e-live-${suffix.slice(0, 10)}`;

    // ── Create via the real backend → real Airweave ─────────────────
    const createRes = await fetch(
      `${API_BASE_URL}/api/airweave/collections`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: displayName, slugHint }),
      },
    );
    expect(createRes.status, `create response body: ${await createRes
      .clone()
      .text()
      .catch(() => '<unreadable>')}`).toBe(201);
    const createBody = (await createRes.json()) as {
      data: { id: string; name: string; readableId: string };
    };
    const created = createBody.data;
    // CRITICAL: register for cleanup BEFORE any assertion that might
    // fail — otherwise a regex miss leaks a real Airweave collection.
    createdInTest.push({ readableId: created.readableId });

    expect(created.name).toBe(displayName);
    // Contract per ADR-011 § Decision 10 + Amendment 1:
    // `${orgSlug}-${slugPart}-${randomBytes(4).toString('hex')}`. The
    // slugPart truncates to 32 chars after the orgSlug prefix collapses.
    // We assert: starts with our slugHint, ends with 8 hex chars.
    expect(created.readableId).toMatch(/-[a-f0-9]{8}$/);
    expect(created.readableId).toContain(slugHint);

    // ── LIST page renders the freshly-created collection ─────────────
    await page.goto('/admin/airweave');
    await expect(
      page.getByRole('heading', { name: /airweave collections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: displayName, exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('cell', { name: created.readableId }),
    ).toBeVisible();

    // ── DETAIL endpoint returns 200 (proves guard + downstream chain) ──
    const detailRes = await fetch(
      `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(created.readableId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as {
      data: { id: string; name: string; readableId: string };
    };
    expect(detailBody.data.readableId).toBe(created.readableId);

    // ── DETAIL page navigates and renders ────────────────────────────
    await page.goto(
      `/admin/airweave/${encodeURIComponent(created.readableId)}`,
    );
    await expect(
      page.getByRole('heading', { name: displayName }),
    ).toBeVisible({ timeout: 10000 });

    // ── DELETE via direct API → confirm gone ─────────────────────────
    // Backend's controller returns 200 + `{data: {deleted: true,
    // collectionId}}` (airweave.controller.ts deleteCollection), not 204.
    const delRes = await fetch(
      `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(created.readableId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(delRes.status).toBe(200);
    const delBody = (await delRes.json()) as {
      data: { deleted: boolean; collectionId: string };
    };
    expect(delBody.data.deleted).toBe(true);
    expect(delBody.data.collectionId).toBe(created.readableId);
    createdInTest = []; // already cleaned upstream

    // Re-fetch → 404 (or 403 if read-lockdown enforces post-delete;
    // either way NOT 200 because the allowlist entry is gone).
    const reRes = await fetch(
      `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(created.readableId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect([403, 404]).toContain(reRes.status);
  });

  test('OAuth connect-session endpoint returns a usable sessionToken from real Airweave', async ({
    page,
  }) => {
    // This validates the LAST mile of the SDK handoff that the unit
    // suite stubs and the mocked e2e fakes. With real Airweave creds,
    // POST /api/airweave/collections/:id/source-connections (OAuth
    // branch) MUST return a sessionToken the SDK can hand off to
    // connect.airweave.ai.
    //
    // We don't drive the upstream provider flow (Slack login etc.) —
    // that needs interactive credentials. We DO prove the token is
    // present and shaped correctly.
    await loginAsAdmin(page);
    const token = await getBearer(page);

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const collName = `E2E Live OAuth ${suffix}`;
    const slugHint = `e2e-live-oa-${suffix.slice(0, 8)}`;

    const collRes = await fetch(`${API_BASE_URL}/api/airweave/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: collName, slugHint }),
    });
    expect(collRes.status).toBe(201);
    const coll = ((await collRes.json()) as { data: { readableId: string } })
      .data;
    createdInTest.push({ readableId: coll.readableId });

    // Initiate an OAuth source-connection. Slack is a common OAuth
    // connector and ships in the default Airweave catalog.
    const srcRes = await fetch(
      `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(coll.readableId)}/source-connections`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'E2E Live Slack',
          shortName: 'slack',
          authentication: { kind: 'oauth' },
        }),
      },
    );
    expect(srcRes.status, `oauth source body: ${await srcRes
      .clone()
      .text()
      .catch(() => '<unreadable>')}`).toBeLessThan(500);

    if (srcRes.status === 201) {
      const body = (await srcRes.json()) as {
        data: { sourceConnection: { id: string }; sessionToken?: string };
      };
      expect(body.data.sourceConnection.id).toBeTruthy();
      // The contract the SDK depends on (ADR-011 Amendment 2): the
      // OAuth-branch response carries `sessionToken` directly in the
      // envelope's data. If this is absent, the SPA's
      // "no OAuth session token" toast fires — the defensive branch
      // we already e2e-tested in oauth-flow.spec.ts. Asserting truthy
      // here closes that branch on REAL Airweave.
      expect(body.data.sessionToken).toBeTruthy();
      expect(typeof body.data.sessionToken).toBe('string');
      expect(body.data.sessionToken!.length).toBeGreaterThan(8);
    } else {
      // Upstream Airweave may return 422 if `slack` isn't enabled on
      // the shared test account. Surface the error verbatim — it's
      // information about Airweave config, not a SPA/backend bug.
      const errorText = await srcRes.text().catch(() => '<unreadable>');
      throw new Error(
        `Real-Airweave OAuth source create returned ${srcRes.status}. ` +
          `If this is 422 with "source 'slack' is not enabled", enable ` +
          `OAuth connectors on the team Airweave account. Body: ${errorText}`,
      );
    }
  });
});
