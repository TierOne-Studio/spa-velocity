import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockFetch = vi.fn();
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

import { airweaveKeys } from '../airweaveKeys';
import { useAirweaveSourceConnections } from '../useAirweaveSourceConnections';
import { useCreateAirweaveSourceConnection } from '../useCreateAirweaveSourceConnection';
import { useUpdateAirweaveSourceConnection } from '../useUpdateAirweaveSourceConnection';
import { useDeleteAirweaveSourceConnection } from '../useDeleteAirweaveSourceConnection';
import { useReauthAirweaveSourceConnection } from '../useReauthAirweaveSourceConnection';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

beforeEach(() => {
  mockFetch.mockReset();
  for (const k of Object.keys(storage)) delete storage[k];
});
afterEach(() => vi.clearAllMocks());

describe('useAirweaveSourceConnections', () => {
  it('fetches and unwraps the list envelope', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'src-1',
            name: 'Slack',
            shortName: 'slack',
            collectionReadableId: 'acme-x-deadbeef',
          },
        ],
      }),
    );
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useAirweaveSourceConnections('acme-x-deadbeef'),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useCreateAirweaveSourceConnection', () => {
  it('direct branch — invalidates sourceConnections + detail + lists', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ data: { sourceConnection: { id: 'src-1' } } }),
    );
    const { queryClient, Wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateAirweaveSourceConnection(), {
      wrapper: Wrapper,
    });

    const out = await result.current.mutateAsync({
      collectionReadableId: 'acme-x-deadbeef',
      input: {
        name: 'Slack',
        shortName: 'slack',
        authentication: { kind: 'direct', credentials: { token: 'xoxb-…' } },
      },
    });

    expect(out.sourceConnection.id).toBe('src-1');
    expect(spy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.sourceConnections('acme-x-deadbeef'),
    });
    expect(spy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.detail('acme-x-deadbeef'),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: airweaveKeys.all });
  });

  // ADR-011 § Amendment 4: the "OAuth branch — returns sessionToken
  // alongside the source connection" test was removed. OAuth source-
  // connection creation no longer routes through this hook —
  // `createSourceConnection` only accepts `kind: 'direct'` and never
  // returns a `sessionToken`. The OAuth flow lives in the SDK catalog
  // widget; session tokens come from `createConnectSession` (which has
  // its own test coverage in source-connections.service.test.ts).
});

describe('useUpdateAirweaveSourceConnection', () => {
  it('invalidates ONLY the parent collection sourceConnections list (not detail or all)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { id: 'src-1' } }));
    const { queryClient, Wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateAirweaveSourceConnection(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      sourceConnectionId: 'src-1',
      collectionReadableId: 'acme-x-deadbeef',
      input: { name: 'Renamed' },
    });

    expect(spy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.sourceConnections('acme-x-deadbeef'),
    });
    // Should NOT touch detail or all — rename doesn't change sourceConnectionCount.
    expect(spy).not.toHaveBeenCalledWith({ queryKey: airweaveKeys.all });
    expect(spy).not.toHaveBeenCalledWith({
      queryKey: airweaveKeys.detail('acme-x-deadbeef'),
    });
  });
});

describe('useDeleteAirweaveSourceConnection', () => {
  it('invalidates sourceConnections + detail + lists (count changed)', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ data: { deleted: true, sourceConnectionId: 'src-1' } }),
    );
    const { queryClient, Wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteAirweaveSourceConnection(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      sourceConnectionId: 'src-1',
      collectionReadableId: 'acme-x-deadbeef',
    });

    expect(spy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.sourceConnections('acme-x-deadbeef'),
    });
    expect(spy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.detail('acme-x-deadbeef'),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: airweaveKeys.all });
  });
});

describe('useReauthAirweaveSourceConnection', () => {
  it('returns sessionToken without invalidating any caches', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ data: { sessionToken: 'connect-tok' } }),
    );
    const { queryClient, Wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReauthAirweaveSourceConnection(), {
      wrapper: Wrapper,
    });

    const out = await result.current.mutateAsync('src-1');

    expect(out.sessionToken).toBe('connect-tok');
    // Reauth doesn't change cached state — the source-connection list
    // refreshes when the user comes back from the OAuth portal.
    expect(spy).not.toHaveBeenCalled();
  });
});
