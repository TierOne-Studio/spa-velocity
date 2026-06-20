import { vi } from 'vitest';

/**
 * Shared setup for the Airweave service tests (airweave-collections.service,
 * source-connections.service). Importing this module installs the
 * `localStorage` shim (so `fetchWithAuth` can read `bearer_token`) and a
 * stubbed global `fetch` as module side-effects — import it BEFORE the
 * service under test so the stubs are in place when it loads.
 */

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

export const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The most recent `fetch` call as `[url, init]`. */
export function lastRequest(): [string, RequestInit] {
  const calls = mockFetch.mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

/** Reset fetch + localStorage between tests — call from `beforeEach`. */
export function resetAirweaveServiceMocks() {
  mockFetch.mockReset();
  for (const k of Object.keys(storage)) delete storage[k];
}
