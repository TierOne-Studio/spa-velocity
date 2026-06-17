import type { Page, Route } from '@playwright/test';

/**
 * Shared mock harness for `/api/airweave/**` routes used by the e2e
 * specs in this directory. We mock the backend so the tests:
 *   - don't require a live Airweave staging account
 *   - don't depend on `AIRWEAVE_API_KEY` being set in the test backend
 *   - exercise the SPA wire shape end-to-end (URL paths, request bodies,
 *     response envelope `{data: T}` shape)
 *
 * The harness is mutable: tests can push to `calls` to assert what was
 * sent, and reassign `state.collections` / `state.sources` between
 * actions to simulate optimistic updates landing.
 *
 * Per spa repo convention (mirrors `e2e/projects/projects-crud.spec.ts`).
 */
export type MockCollection = {
  id: string;
  name: string;
  readableId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  status: string | null;
  sourceConnectionCount: number;
};

export type MockSource = {
  id: string;
  name: string;
  shortName: string;
  airweaveCollectionReadableId: string;
  createdAt: string;
  updatedAt: string;
  isAuthenticated: boolean;
  entityCount: number;
  authMethod: 'direct' | 'oauth_browser';
  status: 'active' | 'ready' | 'pending' | 'error';
};

export type AirweaveMockState = {
  collections: MockCollection[];
  sources: MockSource[];
  /** Bumped on collection/source mutations to short-circuit duplicate writes. */
  seq: number;
  /**
   * When set on a collection's readableId, the DELETE handler returns a
   * 409 with the listed projects (matching the backend's "in-use" body
   * shape). Lets the e2e drive the DeleteAirweaveCollectionDialog 409 flow
   * without needing a real referencing-project row.
   */
  deleteCollectionConflicts?: Record<
    string,
    Array<{ id: string; name: string }>
  >;
};

export type AirweaveMockCalls = {
  createCollection: Array<{ name: string; slugHint?: string }>;
  patchCollection: Array<{ readableId: string; body: unknown }>;
  deleteCollection: string[];
  createSource: Array<{
    airweaveCollectionReadableId: string;
    body: Record<string, unknown>;
  }>;
  deleteSource: string[];
  /** Each `POST /api/airweave/source-connections/:id/reauth` call. */
  reauthSource: string[];
  /**
   * Each `POST /api/airweave/connect/session` call (ADR-011 § Amendment 4
   * primary OAuth path — opens the SDK catalog widget). Body is the
   * `{airweaveCollectionId}` payload the SPA sends.
   */
  connectSession: Array<{ airweaveCollectionId: string }>;
};

export function newCalls(): AirweaveMockCalls {
  return {
    createCollection: [],
    patchCollection: [],
    deleteCollection: [],
    createSource: [],
    deleteSource: [],
    reauthSource: [],
    connectSession: [],
  };
}

/**
 * Installs `page.route` handlers for every `/api/airweave/**` endpoint
 * the SPA touches. Mutates `state` in place so tests can observe optimistic
 * cache updates landing.
 *
 * `nextSessionToken` is read on each OAuth create call — defaults to
 * `'tok-fresh'`. Tests can swap it (or null it) per-call to drive the
 * `sessionToken-missing` branch.
 */
export async function installAirweaveMocks(
  page: Page,
  state: AirweaveMockState,
  calls: AirweaveMockCalls,
  opts: { nextSessionToken?: string | null } = {},
): Promise<void> {
  // List + Create on /api/airweave/collections (no trailing path)
  await page.route('**/api/airweave/collections', async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: state.collections }),
      });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as {
        name: string;
        slugHint?: string;
      };
      calls.createCollection.push(body);
      state.seq += 1;
      const created: MockCollection = {
        id: `col-${state.seq}`,
        name: body.name,
        readableId: `${(body.slugHint ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 32)}-${state.seq.toString(16).padStart(8, '0')}`,
        organizationId: state.collections[0]?.organizationId ?? 'org-test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        sourceConnectionCount: 0,
      };
      state.collections = [...state.collections, created];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: created }),
      });
      return;
    }
    await route.fallback();
  });

  // Detail + PATCH + DELETE on /api/airweave/collections/:readableId
  await page.route(
    '**/api/airweave/collections/*',
    async (route: Route) => {
      const url = new URL(route.request().url());
      const segments = url.pathname.split('/');
      const readableId = decodeURIComponent(segments[segments.length - 1]);
      const method = route.request().method();

      const idx = state.collections.findIndex(
        (c) => c.readableId === readableId,
      );
      if (idx === -1) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Collection not found' }),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: state.collections[idx] }),
        });
        return;
      }
      if (method === 'PATCH') {
        const body = route.request().postDataJSON() as { name?: string };
        calls.patchCollection.push({ readableId, body });
        state.collections[idx] = {
          ...state.collections[idx],
          name: body.name ?? state.collections[idx].name,
          updatedAt: new Date().toISOString(),
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: state.collections[idx] }),
        });
        return;
      }
      if (method === 'DELETE') {
        calls.deleteCollection.push(readableId);
        const conflictProjects = state.deleteCollectionConflicts?.[readableId];
        if (conflictProjects && conflictProjects.length > 0) {
          // Matches the backend's 409 "in-use" shape (per ADR-011).
          // Dialog flips to the "Collection in use" state with the list.
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Collection is referenced by projects',
              projects: conflictProjects,
            }),
          });
          return;
        }
        state.collections.splice(idx, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.fallback();
    },
  );

  // Sources LIST on /api/airweave/sources/:airweaveCollectionReadableId
  await page.route('**/api/airweave/sources/*', async (route: Route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/');
    const airweaveCollectionReadableId = decodeURIComponent(
      segments[segments.length - 1],
    );
    if (route.request().method() === 'GET') {
      const list = state.sources.filter(
        (s) => s.airweaveCollectionReadableId === airweaveCollectionReadableId,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: list }),
      });
      return;
    }
    await route.fallback();
  });

  // Source create on /api/airweave/collections/:id/source-connections
  await page.route(
    '**/api/airweave/collections/*/source-connections',
    async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const url = new URL(route.request().url());
      const segments = url.pathname.split('/');
      // /api/airweave/collections/:id/source-connections → :id is at -2
      const airweaveCollectionReadableId = decodeURIComponent(
        segments[segments.length - 2],
      );
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.createSource.push({ airweaveCollectionReadableId, body });
      state.seq += 1;
      const authBlock = body.authentication as { kind: 'direct' | 'oauth' };
      const created: MockSource = {
        id: `src-${state.seq}`,
        name: String(body.name ?? `Source ${state.seq}`),
        shortName: String(body.shortName ?? 'unknown'),
        airweaveCollectionReadableId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAuthenticated: authBlock.kind === 'direct',
        entityCount: 0,
        authMethod: authBlock.kind === 'direct' ? 'direct' : 'oauth_browser',
        status: authBlock.kind === 'direct' ? 'active' : 'pending',
      };
      state.sources = [...state.sources, created];

      const responseBody: Record<string, unknown> = { sourceConnection: created };
      if (authBlock.kind === 'oauth') {
        // null disables the token to drive the missing-token branch
        if (opts.nextSessionToken !== null) {
          responseBody.sessionToken = opts.nextSessionToken ?? 'tok-fresh';
        }
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: responseBody }),
      });
    },
  );

  // Connect session on /api/airweave/connect/session — ADR-011 Amendment 4
  // primary OAuth path. SPA's "Connect a source" button POSTs here with
  // {airweaveCollectionId} on every click; backend returns {sessionToken} that
  // gets handed to the SDK catalog widget.
  await page.route('**/api/airweave/connect/session', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as { airweaveCollectionId: string };
    calls.connectSession.push({ airweaveCollectionId: body.airweaveCollectionId });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { sessionToken: opts.nextSessionToken ?? 'tok-connect-mock' },
      }),
    });
  });

  // Reauth on /api/airweave/source-connections/:id/reauth
  // Registered BEFORE the more general /source-connections/* route so it
  // wins for the suffixed URL (Playwright matches in registration order
  // last-first, so this needs to be the more-specific pattern declared
  // later — see source-connection list mock above).
  await page.route(
    '**/api/airweave/source-connections/*/reauth',
    async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const url = new URL(route.request().url());
      const segments = url.pathname.split('/');
      // /api/airweave/source-connections/:id/reauth → :id is at -2
      const sourceId = decodeURIComponent(segments[segments.length - 2]);
      calls.reauthSource.push(sourceId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { sessionToken: opts.nextSessionToken ?? 'tok-reauth-fresh' },
        }),
      });
    },
  );

  // Source DELETE / PATCH on /api/airweave/source-connections/:id
  await page.route(
    '**/api/airweave/source-connections/*',
    async (route: Route) => {
      const url = new URL(route.request().url());
      // Skip the /reauth suffix — handled above.
      if (url.pathname.endsWith('/reauth')) {
        await route.fallback();
        return;
      }
      const segments = url.pathname.split('/');
      const sourceId = decodeURIComponent(segments[segments.length - 1]);
      const method = route.request().method();
      if (method === 'DELETE') {
        calls.deleteSource.push(sourceId);
        state.sources = state.sources.filter((s) => s.id !== sourceId);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'PATCH') {
        const body = route.request().postDataJSON() as { name?: string };
        const idx = state.sources.findIndex((s) => s.id === sourceId);
        if (idx !== -1) {
          state.sources[idx] = {
            ...state.sources[idx],
            name: body.name ?? state.sources[idx].name,
          };
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: state.sources[idx] }),
          });
          return;
        }
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'not found' }),
        });
        return;
      }
      await route.fallback();
    },
  );
}

/**
 * Installs a window-level stub for `@airweave/connect-react` BEFORE the
 * SPA bundle loads. The dynamic-imported SDK module is intercepted via a
 * service-worker-style import-map shim — too fragile across browsers — so
 * we take the pragmatic route: expose a window flag the wrapper hook
 * can't see, then assert on observable side-effects (toast, dialog close,
 * Network panel POST).
 *
 * For OAuth e2e we instead assert the dialog's POST-then-close behavior
 * (what the page does BEFORE handing off to the SDK), which is what we
 * actually want to pin — the SDK iframe handshake is covered by the unit
 * suite in `useAirweaveConnectModal.test.tsx`.
 */
export async function recordSdkOpens(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __airweaveSdkOpens: number }).__airweaveSdkOpens = 0;
  });
}
