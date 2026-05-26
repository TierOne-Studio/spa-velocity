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

  test('POST /api/airweave/connect/session returns a real sessionToken (ADR-011 Amendment 4)', async ({
    page,
  }) => {
    // This is the canonical SDK handoff endpoint per Amendment 4 — the
    // SPA's catalog-widget flow calls it every time the user clicks
    // "Connect a source". The token is what the SDK passes to the
    // Airweave Connect widget; the widget then drives source-picker +
    // upstream-auth itself.
    //
    // No source-connection is pre-created here — that's the
    // architectural correction Amendment 4 introduces. The widget
    // creates the source-connection AFTER the user picks + auths.
    await loginAsAdmin(page);
    const token = await getBearer(page);

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const collName = `E2E Live Connect ${suffix}`;
    const slugHint = `e2e-live-cs-${suffix.slice(0, 8)}`;

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

    const sessionRes = await fetch(
      `${API_BASE_URL}/api/airweave/connect/session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collectionId: coll.readableId }),
      },
    );
    expect(sessionRes.status, `connect-session body: ${await sessionRes
      .clone()
      .text()
      .catch(() => '<unreadable>')}`).toBe(201);

    const body = (await sessionRes.json()) as {
      data: { sessionToken: string };
    };
    expect(body.data.sessionToken).toBeTruthy();
    expect(typeof body.data.sessionToken).toBe('string');
    expect(body.data.sessionToken.length).toBeGreaterThan(8);
  });

  // ADR-011 § Amendment 4: the "Reauth endpoint returns a fresh
  // sessionToken from real Airweave" test was removed because we no
  // longer have a way to create a pending OAuth source-connection
  // without driving the catalog widget through real human-OAuth. The
  // reauth wire contract stays covered by `reauth.spec.ts` (mocked
  // backend) plus the connect-session live test above (real upstream
  // session-token endpoint). To re-add this test against real
  // Airweave, we'd need to call Airweave's POST /source-connections
  // directly with AIRWEAVE_API_KEY — out of scope for now.
  test.skip('Reauth endpoint returns a fresh sessionToken from real Airweave', async ({
    page,
  }) => {
    // Closes the reauth coverage gap — until this, reauth was only
    // proven against mocked backend (e2e/airweave/reauth.spec.ts).
    // Validates that POST /api/airweave/source-connections/:id/reauth
    // really round-trips through Airweave and returns a fresh token
    // usable by the SDK widget.
    await loginAsAdmin(page);
    const token = await getBearer(page);

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const slugHint = `e2e-live-ra-${suffix.slice(0, 8)}`;

    const collRes = await fetch(`${API_BASE_URL}/api/airweave/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: `E2E Live Reauth ${suffix}`, slugHint }),
    });
    expect(collRes.status).toBe(201);
    const coll = ((await collRes.json()) as { data: { readableId: string } })
      .data;
    createdInTest.push({ readableId: coll.readableId });

    const srcRes = await fetch(
      `${API_BASE_URL}/api/airweave/collections/${encodeURIComponent(coll.readableId)}/source-connections`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'E2E Live Slack Reauth',
          shortName: 'slack',
          authentication: { kind: 'oauth' },
        }),
      },
    );
    expect(srcRes.status).toBe(201);
    const srcBody = (await srcRes.json()) as {
      data: {
        sourceConnection: { id: string };
        sessionToken: string;
      };
    };
    const sourceId = srcBody.data.sourceConnection.id;
    const initialToken = srcBody.data.sessionToken;
    expect(sourceId).toBeTruthy();
    expect(initialToken).toBeTruthy();

    // Call /reauth — backend goes back to Airweave for a brand-new
    // session token for the SAME source-connection (pending OAuth row).
    const reauthRes = await fetch(
      `${API_BASE_URL}/api/airweave/source-connections/${encodeURIComponent(sourceId)}/reauth`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    // Backend's controller returns 201 from POST /reauth (NestJS @Post
    // default), not 200. Both signal success — the SPA uses the body,
    // not the status, to drive the SDK handoff.
    expect(reauthRes.status, `reauth body: ${await reauthRes
      .clone()
      .text()
      .catch(() => '<unreadable>')}`).toBe(201);
    const reauthBody = (await reauthRes.json()) as {
      data: { sessionToken: string };
    };
    expect(reauthBody.data.sessionToken).toBeTruthy();
    expect(typeof reauthBody.data.sessionToken).toBe('string');
    expect(reauthBody.data.sessionToken.length).toBeGreaterThan(8);
    // Airweave should issue a DIFFERENT token on reauth (per 10-min TTL
    // contract). If they're the same, the SDK widget would still work
    // but the test is less informative — just log a soft warning.
    if (reauthBody.data.sessionToken === initialToken) {
      console.warn(
        '[airweave-live] reauth returned the SAME sessionToken as initial create — unusual but not a failure',
      );
    }
  });

  test('SDK catalog widget mounts at connect.airweave.ai when "Connect a source" is clicked (ADR-011 Amendment 4)', async ({
    page,
  }) => {
    // The deepest validation of the catalog-widget flow short of a
    // human clicking "Authorize" on Slack's page. Walks the SPA UI
    // end-to-end:
    //   - log in as admin
    //   - create a real collection via the live backend
    //   - navigate to its detail page
    //   - click "Connect a source" (Amendment 4 primary CTA)
    //   - page calls POST /api/airweave/connect/session → backend
    //     returns sessionToken → SDK opens iframe at connect.airweave.ai
    //   - Playwright waits for the SDK's `#airweave-connect-root`
    //     portal + iframe with `title="Airweave Connect"`
    //
    // The widget renders its catalog (full source picker) inside the
    // iframe — that's the per-Amendment-4 UX the docs describe at
    // https://docs.airweave.ai/connect. The user picks a source +
    // authenticates inline; the human-OAuth click stays out of e2e by
    // industry norm.
    await loginAsAdmin(page);
    const token = await getBearer(page);

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const slugHint = `e2e-live-fr-${suffix.slice(0, 8)}`;

    const collRes = await fetch(`${API_BASE_URL}/api/airweave/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: `E2E Live Frame ${suffix}`,
        slugHint,
      }),
    });
    expect(collRes.status).toBe(201);
    const coll = ((await collRes.json()) as { data: { readableId: string } })
      .data;
    createdInTest.push({ readableId: coll.readableId });

    // Capture all console messages + page errors + network requests
    // for diagnosis. Wrap fetch on the page to log every SDK-relevant
    // request so we can prove the SPA's `getSessionToken` callback is
    // (or isn't) reached and what the backend returns.
    const consoleErrors: string[] = [];
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[pageerror] ${err.message}`);
    });

    // Track fetches + body.appendChild calls. document.body may be
    // null when this init script runs (before DOM parse), so defer
    // the appendChild wrap until DOMContentLoaded.
    await page.addInitScript(() => {
      // @ts-expect-error window props injected for diagnosis
      window.__airweaveDiag = {
        fetches: [],
        bodyAppendChildIds: [],
      };
      const origFetch = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const url =
          typeof args[0] === 'string'
            ? args[0]
            : args[0] instanceof URL
              ? args[0].toString()
              : (args[0] as Request).url;
        if (url.includes('airweave') || url.includes('source-connection')) {
          // @ts-expect-error
          window.__airweaveDiag.fetches.push({ url, ts: Date.now() });
        }
        return origFetch(...args);
      };
      const wrapAppend = () => {
        if (!document.body) return;
        const origAppend = document.body.appendChild.bind(document.body);
        document.body.appendChild = ((node: Node) => {
          const el = node as HTMLElement;
          // @ts-expect-error
          window.__airweaveDiag.bodyAppendChildIds.push(
            `${el.tagName ?? '?'}#${el.id ?? ''} @${Date.now()}`,
          );
          return origAppend(node);
        }) as typeof document.body.appendChild;
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapAppend);
      } else {
        wrapAppend();
      }
    });

    await page.goto(`/admin/airweave/${encodeURIComponent(coll.readableId)}`);
    await expect(
      page.getByRole('heading', { name: new RegExp(`E2E Live Frame ${suffix}`) }),
    ).toBeVisible({ timeout: 15000 });

    // Click "Connect a source" — the primary catalog-widget CTA per
    // ADR-011 § Amendment 4. The page calls POST /api/airweave/connect/session,
    // hands the returned token to the SDK, and the SDK opens its iframe
    // pointed at connect.airweave.ai. No dialog, no shortName form, no
    // pre-created source-connection — the widget will create one after
    // the user picks a source + authenticates.
    await page
      .getByRole('button', { name: /^connect a source$/i })
      .click();

    // The SDK creates a portal root `<div id="airweave-connect-root">`
    // appended to document.body, then React-portals its modal + iframe
    // into that div. Asserting on the root first gives a clearer failure
    // mode if open() never fires than waiting for the iframe directly.
    const sdkRoot = page.locator('#airweave-connect-root');
    try {
      // 30s ceiling — when Airweave's upstream is slow (rate-limited
    // after concurrent live tests) the source-create POST + iframe
    // load can take 20-25s. Solo runs are ~15s; full-suite runs
    // sometimes need the headroom.
    await expect(sdkRoot).toBeAttached({ timeout: 30000 });
    } catch (err) {
      const allIframes = await page
        .locator('iframe')
        .evaluateAll((els) =>
          els.map((e) => ({
            src: (e as HTMLIFrameElement).src,
            title: (e as HTMLIFrameElement).title,
          })),
        );
      const bodyChildren = await page.evaluate(() =>
        Array.from(document.body.children).map((c) => ({
          tag: c.tagName,
          id: c.id,
          cls: c.className,
        })),
      );
      // Check for sonner toast — if onOAuthSubmit never fired, there
      // would be a "no OAuth session token" toast (defensive branch).
      const toastTexts = await page
        .locator('[data-sonner-toast], [role="status"]')
        .allTextContents()
        .catch(() => []);
      const diag = await page
        .evaluate(() => (window as unknown as { __airweaveDiag: unknown }).__airweaveDiag)
        .catch(() => null);
      console.error(
        `[live-iframe] No #airweave-connect-root after open().\n` +
          `  Errors:  ${consoleErrors.join(' | ') || '(none)'}\n` +
          `  Toasts:  ${JSON.stringify(toastTexts)}\n` +
          `  iframes: ${JSON.stringify(allIframes)}\n` +
          `  body:    ${JSON.stringify(bodyChildren)}\n` +
          `  recent console: ${consoleLogs.slice(-10).join(' || ')}\n` +
          `  airweave diag: ${JSON.stringify(diag)}`,
      );
      throw err;
    }

    // Now wait for the iframe inside the portal root. The SDK identifies
    // its iframe with `title="Airweave Connect"` (bundled dist/index.js).
    const iframeLocator = page.locator('iframe[title="Airweave Connect"]');
    await expect(iframeLocator).toBeAttached({ timeout: 10000 });

    const iframeUrl = await iframeLocator.first().getAttribute('src');
    expect(iframeUrl, `iframe src: ${iframeUrl}`).toBeTruthy();
    expect(iframeUrl).toMatch(/^https:\/\/connect\.airweave\.ai/);

    // Wait for the iframe document itself to load — the SDK's iframe
    // sends REQUEST_TOKEN on load and our wrapper responds with the
    // sessionToken. A loaded iframe with a present <body> means that
    // round-trip completed without a network or origin failure.
    const frame = page
      .frameLocator('iframe[title="Airweave Connect"]')
      .first();
    await expect(frame.locator('body')).toBeAttached({ timeout: 20000 });

    // Confirm zero SDK-related console errors during the handshake.
    const sdkErrors = consoleErrors.filter((line) =>
      /airweave|connect|postMessage|TOKEN_RESPONSE/i.test(line),
    );
    expect(
      sdkErrors,
      `SDK-related console errors during handshake: ${sdkErrors.join(' | ')}`,
    ).toEqual([]);
  });
});
