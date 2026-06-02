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

import { KnowledgeBaseApiError } from '../../lib/api-response';
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBase,
  listKnowledgeBases,
  updateKnowledgeBase,
} from '../knowledge-bases.service';

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

describe('knowledge-bases.service', () => {
  describe('listKnowledgeBases', () => {
    it('GETs /api/knowledge-bases and unwraps the envelope', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [kb] }));

      const result = await listKnowledgeBases();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/knowledge-bases(\?|$)/);
      expect((init.method ?? 'GET')).toBe('GET');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('kb-1');
    });

    it('throws KnowledgeBaseApiError on non-2xx', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));
      await expect(listKnowledgeBases()).rejects.toBeInstanceOf(KnowledgeBaseApiError);
    });
  });

  describe('getKnowledgeBase', () => {
    it('GETs /api/knowledge-bases/:id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: kb }));

      await getKnowledgeBase('kb-1');

      const [url] = lastRequest();
      expect(url).toMatch(/\/api\/knowledge-bases\/kb-1$/);
    });
  });

  describe('createKnowledgeBase', () => {
    it('POSTs with the input body and unwraps the result', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: kb }));

      await createKnowledgeBase({ name: 'Docs', description: 'My docs' });

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/knowledge-bases(\?|$)/);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'Docs', description: 'My docs' }));
    });

    it('surfaces 409 as KnowledgeBaseApiError', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: 'A knowledge base named "Docs" already exists' }, 409),
      );
      await expect(createKnowledgeBase({ name: 'Docs' })).rejects.toBeInstanceOf(
        KnowledgeBaseApiError,
      );
    });
  });

  describe('updateKnowledgeBase', () => {
    it('PATCHes with the new name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { ...kb, name: 'Renamed' } }));

      await updateKnowledgeBase('kb-1', { name: 'Renamed' });

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/knowledge-bases\/kb-1$/);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }));
    });
  });

  describe('deleteKnowledgeBase', () => {
    it('DELETEs and resolves on 200', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { deleted: true } }));

      await expect(deleteKnowledgeBase('kb-1')).resolves.toBeUndefined();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/knowledge-bases\/kb-1$/);
      expect(init.method).toBe('DELETE');
    });

    it('surfaces 409 as KnowledgeBaseApiError when project references exist', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          { message: 'Cannot delete knowledge base: 2 project data source(s) still reference it.' },
          409,
        ),
      );
      try {
        await deleteKnowledgeBase('kb-1');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(KnowledgeBaseApiError);
        expect((err as KnowledgeBaseApiError).status).toBe(409);
      }
    });
  });
});
