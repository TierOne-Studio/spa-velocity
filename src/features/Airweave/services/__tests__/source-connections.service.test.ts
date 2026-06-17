import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((k: string) => storage[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      storage[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete storage[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(storage)) delete storage[k];
    }),
  },
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  createConnectSession,
  createSourceConnection,
  deleteSourceConnection,
  listSourceConnections,
  reauthSourceConnection,
  updateSourceConnection,
} from '../source-connections.service';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastRequest(): [string, RequestInit] {
  const calls = mockFetch.mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

beforeEach(() => {
  mockFetch.mockReset();
  for (const k of Object.keys(storage)) delete storage[k];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('source-connections.service', () => {
  describe('listSourceConnections', () => {
    it('GETs /api/airweave/sources/:airweaveCollectionId', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }));
      await listSourceConnections('acme-x-deadbeef');
      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/sources\/acme-x-deadbeef$/);
      expect(init.method ?? 'GET').toBe('GET');
    });
  });

  describe('createSourceConnection', () => {
    it('POSTs the direct-auth body verbatim', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { sourceConnection: { id: 'src-1' } } }),
      );

      await createSourceConnection('acme-x-deadbeef', {
        name: 'Slack',
        shortName: 'slack',
        authentication: {
          kind: 'direct',
          credentials: { token: 'xoxb-…' },
        },
      });

      const [url, init] = lastRequest();
      expect(url).toMatch(
        /\/api\/airweave\/collections\/acme-x-deadbeef\/source-connections$/,
      );
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body));
      expect(body.authentication.kind).toBe('direct');
      expect(body.authentication.credentials).toEqual({ token: 'xoxb-…' });
    });

    // ADR-011 § Amendment 4 (2026-05-26): the "POSTs the OAuth body
    // and returns sessionToken" test was removed because the service
    // no longer accepts `kind: 'oauth'` and the result no longer
    // carries a `sessionToken`. The catalog-widget flow uses
    // `createConnectSession` for token issuance (own coverage below)
    // and Airweave creates the source-connection itself.
  });

  describe('createConnectSession', () => {
    it('POSTs {airweaveCollectionId} to /api/airweave/connect/session and returns the sessionToken (Amendment 4 primary OAuth path)', async () => {
      // Imported below — pulled into scope for this single block.
      const { createConnectSession } = await import(
        '../source-connections.service'
      );
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { sessionToken: 'tok-from-backend' } }),
      );

      const result = await createConnectSession('acme-x-deadbeef');

      expect(result.sessionToken).toBe('tok-from-backend');
      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/connect\/session$/);
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({ airweaveCollectionId: 'acme-x-deadbeef' });
    });
  });

  describe('updateSourceConnection', () => {
    it('PATCHes with the new name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { id: 'src-1' } }));
      await updateSourceConnection('src-uuid-1', { name: 'Renamed' });
      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/source-connections\/src-uuid-1$/);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }));
    });
  });

  describe('deleteSourceConnection', () => {
    it('DELETEs and resolves on 200', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { deleted: true, sourceConnectionId: 'src-1' } }),
      );
      await expect(
        deleteSourceConnection('src-uuid-1'),
      ).resolves.toBeUndefined();
      const [, init] = lastRequest();
      expect(init.method).toBe('DELETE');
    });
  });

  describe('reauthSourceConnection', () => {
    it('POSTs and returns sessionToken', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { sessionToken: 'connect-tok' } }),
      );
      const result = await reauthSourceConnection('src-uuid-1');
      const [url, init] = lastRequest();
      expect(url).toMatch(
        /\/api\/airweave\/source-connections\/src-uuid-1\/reauth$/,
      );
      expect(init.method).toBe('POST');
      expect(result.sessionToken).toBe('connect-tok');
    });
  });

  describe('createConnectSession', () => {
    it('POSTs with the airweaveCollectionId body and returns sessionToken', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { sessionToken: 'connect-tok' } }),
      );
      const result = await createConnectSession('acme-x-deadbeef');
      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/connect\/session$/);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(
        JSON.stringify({ airweaveCollectionId: 'acme-x-deadbeef' }),
      );
      expect(result.sessionToken).toBe('connect-tok');
    });
  });
});
