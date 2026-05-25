import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage so fetchWithAuth can read bearer_token
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

import { AirweaveApiError } from '../../lib/api-response';
import {
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  updateCollection,
} from '../collections.service';

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

describe('collections.service', () => {
  describe('listCollections', () => {
    it('GETs /api/airweave/collections and unwraps the envelope', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: [{ id: 'c1', readableId: 'acme-a-12345678' }] }),
      );

      const result = await listCollections();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/collections(\?|$)/);
      expect(init.method ?? 'GET').toBe('GET');
      expect(result).toHaveLength(1);
    });

    it('appends ?search= when search is provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }));
      await listCollections('champion');
      const [url] = lastRequest();
      expect(url).toContain('search=champion');
    });
  });

  describe('getCollection', () => {
    it('GETs /api/airweave/collections/:id', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { id: 'c1', readableId: 'acme-a-12345678' } }),
      );
      await getCollection('acme-a-12345678');
      const [url] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/collections\/acme-a-12345678$/);
    });

    it('URL-encodes the readable id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: {} }));
      await getCollection('weird id with spaces');
      const [url] = lastRequest();
      expect(url).toContain('weird%20id%20with%20spaces');
    });
  });

  describe('createCollection', () => {
    it('POSTs with the input body and unwraps detail', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { id: 'c1', readableId: 'acme-x-deadbeef' } }),
      );
      await createCollection({ name: 'X', slugHint: 'x' });
      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/collections(\?|$)/);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'X', slugHint: 'x' }));
    });

    it('surfaces 409 as AirweaveApiError with the collision body', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          { message: "Generated readable_id 'acme-x-deadbeef' collided upstream" },
          409,
        ),
      );
      await expect(
        createCollection({ name: 'X' }),
      ).rejects.toBeInstanceOf(AirweaveApiError);
    });
  });

  describe('updateCollection', () => {
    it('PATCHes with the new name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { id: 'c1' } }));
      await updateCollection('acme-x-deadbeef', { name: 'Renamed' });
      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/airweave\/collections\/acme-x-deadbeef$/);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }));
    });
  });

  describe('deleteCollection', () => {
    it('DELETEs and resolves on 200', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: { deleted: true, collectionId: 'acme-x-deadbeef' } }),
      );
      await expect(
        deleteCollection('acme-x-deadbeef'),
      ).resolves.toBeUndefined();
      const [, init] = lastRequest();
      expect(init.method).toBe('DELETE');
    });

    it('surfaces 409 + project list via AirweaveApiError.body', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          {
            message: 'Collection is in use by one or more projects',
            collectionReadableId: 'acme-x-deadbeef',
            projects: [
              { id: 'p1', name: 'General' },
              { id: 'p2', name: 'Analytics' },
            ],
          },
          409,
        ),
      );

      try {
        await deleteCollection('acme-x-deadbeef');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(AirweaveApiError);
        const e = err as AirweaveApiError;
        expect(e.status).toBe(409);
        const body = e.body as { projects: Array<{ id: string }> };
        expect(body.projects).toHaveLength(2);
      }
    });

    it('surfaces 429 + retryAfterSeconds via AirweaveApiError.body', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: 'Rate limited', retryAfterSeconds: 30 }, 429),
      );

      try {
        await deleteCollection('acme-x-deadbeef');
        throw new Error('expected throw');
      } catch (err) {
        const e = err as AirweaveApiError;
        expect(e.status).toBe(429);
        expect((e.body as { retryAfterSeconds: number }).retryAfterSeconds).toBe(
          30,
        );
      }
    });
  });
});
