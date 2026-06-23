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

import { EmbedSiteApiError } from '../../lib/apiResponse';
import {
  createEmbedSite,
  deleteEmbedSite,
  listEmbedSites,
  rotateEmbedSiteKey,
  updateEmbedSite,
} from '../embedSitesService';

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

const site = {
  id: 'site-1',
  name: 'Acme',
  projectId: 'proj-1',
  publicKey: 'wgt_pub_abc',
  allowedOrigins: ['https://acme.com'],
  enabled: true,
  theme: null,
};

describe('embedSitesService', () => {
  it('listEmbedSites GETs /api/embed-sites and unwraps the envelope', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [site] }));
    const result = await listEmbedSites();
    const [url, init] = lastRequest();
    expect(url).toMatch(/\/api\/embed-sites(\?|$)/);
    expect(init.method ?? 'GET').toBe('GET');
    expect(result).toEqual([site]);
  });

  it('createEmbedSite POSTs the input and returns the created site', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: site }, 201));
    const result = await createEmbedSite({
      name: 'Acme',
      projectId: 'proj-1',
      allowedOrigins: ['https://acme.com'],
    });
    const [url, init] = lastRequest();
    expect(url).toMatch(/\/api\/embed-sites$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ projectId: 'proj-1' });
    expect(result.publicKey).toBe('wgt_pub_abc');
  });

  it('updateEmbedSite PATCHes the id path', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { ...site, enabled: false } }));
    const result = await updateEmbedSite('site-1', { enabled: false });
    const [url, init] = lastRequest();
    expect(url).toMatch(/\/api\/embed-sites\/site-1$/);
    expect(init.method).toBe('PATCH');
    expect(result.enabled).toBe(false);
  });

  it('rotateEmbedSiteKey POSTs to /rotate-key and returns the new key', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { ...site, publicKey: 'wgt_pub_new' } }));
    const result = await rotateEmbedSiteKey('site-1');
    const [url, init] = lastRequest();
    expect(url).toMatch(/\/api\/embed-sites\/site-1\/rotate-key$/);
    expect(init.method).toBe('POST');
    expect(result.publicKey).toBe('wgt_pub_new');
  });

  it('deleteEmbedSite DELETEs and tolerates a 204', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteEmbedSite('site-1')).resolves.toBeUndefined();
    const [url, init] = lastRequest();
    expect(url).toMatch(/\/api\/embed-sites\/site-1$/);
    expect(init.method).toBe('DELETE');
  });

  it('surfaces the server message as EmbedSiteApiError on a 409 conflict', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ message: 'Project already has an embed site' }, 409),
    );
    await expect(
      createEmbedSite({ name: 'x', projectId: 'proj-1', allowedOrigins: [] }),
    ).rejects.toMatchObject({ status: 409, message: 'Project already has an embed site' });
    await expect(
      createEmbedSite({ name: 'x', projectId: 'proj-1', allowedOrigins: [] }),
    ).rejects.toBeInstanceOf(EmbedSiteApiError);
  });
});
