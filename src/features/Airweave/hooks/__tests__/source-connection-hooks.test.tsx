import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  jsonResponse,
  makeWrapper,
  mockFetch,
  resetAirweaveHookMocks,
} from './test-helpers';

import { airweaveKeys } from '../airweaveKeys';
import { useAirweaveSourceConnections } from '../useAirweaveSourceConnections';
import { useCreateAirweaveSourceConnection } from '../useCreateAirweaveSourceConnection';
import { useUpdateAirweaveSourceConnection } from '../useUpdateAirweaveSourceConnection';
import { useDeleteAirweaveSourceConnection } from '../useDeleteAirweaveSourceConnection';
import { useReauthAirweaveSourceConnection } from '../useReauthAirweaveSourceConnection';

beforeEach(resetAirweaveHookMocks);
afterEach(() => vi.clearAllMocks());

// create + delete both fully invalidate — they assert the same trio of keys.
function expectInvalidatedAll(
  spy: MockInstance,
  readableId = 'acme-x-deadbeef',
) {
  expect(spy).toHaveBeenCalledWith({
    queryKey: airweaveKeys.sourceConnections(readableId),
  });
  expect(spy).toHaveBeenCalledWith({ queryKey: airweaveKeys.detail(readableId) });
  expect(spy).toHaveBeenCalledWith({ queryKey: airweaveKeys.all });
}

describe('useAirweaveSourceConnections', () => {
  it('fetches and unwraps the list envelope', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'src-1',
            name: 'Slack',
            shortName: 'slack',
            airweaveCollectionReadableId: 'acme-x-deadbeef',
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
    // Non-vacuous: the renamed wire field is surfaced under the new name.
    expect(result.current.data?.[0].airweaveCollectionReadableId).toBe(
      'acme-x-deadbeef',
    );
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
      airweaveCollectionReadableId: 'acme-x-deadbeef',
      input: {
        name: 'Slack',
        shortName: 'slack',
        authentication: { kind: 'direct', credentials: { token: 'xoxb-…' } },
      },
    });

    expect(out.sourceConnection.id).toBe('src-1');
    expectInvalidatedAll(spy);
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
      airweaveCollectionReadableId: 'acme-x-deadbeef',
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
      airweaveCollectionReadableId: 'acme-x-deadbeef',
    });

    expectInvalidatedAll(spy);
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
