import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Shared setup for the Airweave hook tests (collection-hooks,
 * source-connection-hooks). Importing this module installs the
 * `localStorage` shim (so `fetchWithAuth` can read `bearer_token`) and a
 * stubbed global `fetch` as module side-effects — import it BEFORE the
 * hooks under test so the stubs are in place when they load.
 */

export const mockFetch = vi.fn();

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
vi.stubGlobal('fetch', mockFetch);

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

/** Reset fetch + localStorage between tests — call from `beforeEach`. */
export function resetAirweaveHookMocks() {
  mockFetch.mockReset();
  for (const k of Object.keys(storage)) delete storage[k];
}
