import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((k: string) => storage[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
    removeItem: vi.fn((k: string) => { delete storage[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(storage)) delete storage[k]; }),
  },
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { VectorDbApiError } from '../../lib/api-response';
import {
  createVectorDb,
  deleteVectorDb,
  getVectorDb,
  listVectorDb,
  updateVectorDb,
} from '../vector-dbs.service';

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

beforeEach(() => { mockFetch.mockReset(); });
afterEach(() => { vi.clearAllMocks(); });

const kb = {
  id: 'kb-1',
  name: 'Docs',
  status: 'empty',
  documentCount: 0,
};

describe('vector-dbs.service', () => {
  describe('listVectorDb', () => {
    it('GETs /api/vector-dbs and unwraps the envelope', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [kb] }));

      const result = await listVectorDb();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs(\?|$)/);
      expect((init.method ?? 'GET')).toBe('GET');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('kb-1');
    });

    it('throws VectorDbApiError on non-2xx', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));
      await expect(listVectorDb()).rejects.toBeInstanceOf(VectorDbApiError);
    });
  });

  describe('getVectorDb', () => {
    it('GETs /api/vector-dbs/:id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: kb }));

      await getVectorDb('kb-1');

      const [url] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs\/kb-1$/);
    });
  });

  describe('createVectorDb', () => {
    it('POSTs with the input body and unwraps the result', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: kb }));

      await createVectorDb({ name: 'Docs', description: 'My docs' });

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs(\?|$)/);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'Docs', description: 'My docs' }));
    });

    it('surfaces 409 as VectorDbApiError', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: 'A knowledge base named "Docs" already exists' }, 409),
      );
      await expect(createVectorDb({ name: 'Docs' })).rejects.toBeInstanceOf(
        VectorDbApiError,
      );
    });
  });

  describe('updateVectorDb', () => {
    it('PATCHes with the new name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { ...kb, name: 'Renamed' } }));

      await updateVectorDb('kb-1', { name: 'Renamed' });

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs\/kb-1$/);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }));
    });
  });

  describe('deleteVectorDb', () => {
    it('DELETEs and resolves on 200', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { deleted: true } }));

      await expect(deleteVectorDb('kb-1')).resolves.toBeUndefined();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs\/kb-1$/);
      expect(init.method).toBe('DELETE');
    });

    it('surfaces 409 as VectorDbApiError when project references exist', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          { message: 'Cannot delete knowledge base: 2 project data source(s) still reference it.' },
          409,
        ),
      );
      try {
        await deleteVectorDb('kb-1');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(VectorDbApiError);
        expect((err as VectorDbApiError).status).toBe(409);
      }
    });
  });
});
