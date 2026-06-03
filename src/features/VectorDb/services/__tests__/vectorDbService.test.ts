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

type XhrMock = {
  upload: { addEventListener: ReturnType<typeof vi.fn> };
  addEventListener: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  status: number;
  responseText: string;
};
let xhrMock: XhrMock;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { VectorDbApiError } from '../../lib/apiResponse';
import {
  createVectorDb,
  deleteVectorDb,
  getVectorDb,
  listVectorDb,
  updateVectorDb,
  uploadVectorDb,
} from '../vectorDbService';

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

const vectorDb = {
  id: 'vdb-1',
  name: 'Docs',
  status: 'empty',
  documentCount: 0,
};

describe('vectorDbService', () => {
  describe('listVectorDb', () => {
    it('GETs /api/vector-dbs and unwraps the envelope', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [vectorDb] }));

      const result = await listVectorDb();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs(\?|$)/);
      expect((init.method ?? 'GET')).toBe('GET');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('vdb-1');
    });

    it('throws VectorDbApiError on non-2xx', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));
      await expect(listVectorDb()).rejects.toBeInstanceOf(VectorDbApiError);
    });
  });

  describe('getVectorDb', () => {
    it('GETs /api/vector-dbs/:id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: vectorDb }));

      await getVectorDb('vdb-1');

      const [url] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs\/vdb-1$/);
    });
  });

  describe('createVectorDb', () => {
    it('POSTs with the input body and unwraps the result', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: vectorDb }));

      await createVectorDb({ name: 'Docs', description: 'My docs' });

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs(\?|$)/);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'Docs', description: 'My docs' }));
    });

    it('surfaces 409 as VectorDbApiError', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ message: 'A vector database named "Docs" already exists' }, 409),
      );
      await expect(createVectorDb({ name: 'Docs' })).rejects.toBeInstanceOf(
        VectorDbApiError,
      );
    });
  });

  describe('updateVectorDb', () => {
    it('PATCHes with the new name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { ...vectorDb, name: 'Renamed' } }));

      await updateVectorDb('vdb-1', { name: 'Renamed' });

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs\/vdb-1$/);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Renamed' }));
    });
  });

  describe('deleteVectorDb', () => {
    it('DELETEs and resolves on 200', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { deleted: true } }));

      await expect(deleteVectorDb('vdb-1')).resolves.toBeUndefined();

      const [url, init] = lastRequest();
      expect(url).toMatch(/\/api\/vector-dbs\/vdb-1$/);
      expect(init.method).toBe('DELETE');
    });

    it('surfaces 409 as VectorDbApiError when project references exist', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          { message: 'Cannot delete vector database: 2 project data source(s) still reference it.' },
          409,
        ),
      );
      try {
        await deleteVectorDb('vdb-1');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(VectorDbApiError);
        expect((err as VectorDbApiError).status).toBe(409);
      }
    });
  });

  describe('uploadVectorDb', () => {
    function makeXhrMock(): XhrMock {
      return {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        status: 201,
        responseText: '',
      };
    }

    beforeEach(() => {
      xhrMock = makeXhrMock();
      // eslint-disable-next-line prefer-arrow-callback
      vi.stubGlobal('XMLHttpRequest', function MockXHR(this: unknown) {
        return xhrMock;
      });
    });

    it('opens POST to /api/vector-dbs/:id/upload and sends FormData', async () => {
      const job = {
        id: 'job-1', vectorDbId: 'vdb-1', s3Key: 'k', originalFilename: 'doc.txt',
        fileSizeBytes: '5', contentType: 'text/plain', status: 'pending',
        createdAt: '', updatedAt: '',
      };
      xhrMock.status = 201;
      xhrMock.responseText = JSON.stringify({ data: job });

      xhrMock.addEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === 'load') setTimeout(cb, 0);
      });

      const file = new File(['hello'], 'doc.txt', { type: 'text/plain' });
      const result = await uploadVectorDb('vdb-1', file);

      expect(xhrMock.open).toHaveBeenCalledWith(
        'POST',
        expect.stringContaining('/api/vector-dbs/vdb-1/upload'),
      );
      expect(xhrMock.send).toHaveBeenCalledWith(expect.any(FormData));
      expect(result.id).toBe('job-1');
    });

    it('sets Authorization header when bearer token is present', async () => {
      storage['bearer_token'] = 'tok-abc';
      xhrMock.status = 201;
      xhrMock.responseText = JSON.stringify({
        data: {
          id: 'j', vectorDbId: 'vdb-1', s3Key: 'k', originalFilename: 'f',
          fileSizeBytes: '1', contentType: 'text/plain', status: 'pending',
          createdAt: '', updatedAt: '',
        },
      });

      xhrMock.addEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === 'load') setTimeout(cb, 0);
      });

      const file = new File(['x'], 'x.txt', { type: 'text/plain' });
      await uploadVectorDb('vdb-1', file);

      expect(xhrMock.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok-abc');
    });

    it('rejects with VectorDbApiError on non-2xx response', async () => {
      xhrMock.status = 400;
      xhrMock.responseText = JSON.stringify({ message: 'File type not allowed' });

      xhrMock.addEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === 'load') setTimeout(cb, 0);
      });

      const file = new File(['x'], 'x.exe', { type: 'application/x-executable' });
      await expect(uploadVectorDb('vdb-1', file)).rejects.toBeInstanceOf(VectorDbApiError);
    });

    it('rejects with VectorDbApiError on XHR network error event', async () => {
      xhrMock.addEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === 'error') setTimeout(cb, 0);
      });

      const file = new File(['x'], 'x.txt', { type: 'text/plain' });
      await expect(uploadVectorDb('vdb-1', file)).rejects.toMatchObject({
        name: 'VectorDbApiError',
        status: 0,
        message: expect.stringContaining('Network error'),
      });
    });

    it('rejects with VectorDbApiError when 2xx response body is invalid JSON', async () => {
      xhrMock.status = 201;
      xhrMock.responseText = 'not-json';

      xhrMock.addEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === 'load') setTimeout(cb, 0);
      });

      const file = new File(['x'], 'x.txt', { type: 'text/plain' });
      await expect(uploadVectorDb('vdb-1', file)).rejects.toBeInstanceOf(VectorDbApiError);
    });
  });
});
