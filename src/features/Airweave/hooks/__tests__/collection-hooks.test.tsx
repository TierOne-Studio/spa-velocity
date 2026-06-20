import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  jsonResponse,
  makeWrapper,
  mockFetch,
  resetAirweaveHookMocks,
} from './test-helpers';

import { airweaveKeys } from '../airweaveKeys';
import { useAirweaveCollectionDetail } from '../useAirweaveCollectionDetail';
import { useCreateAirweaveCollection } from '../useCreateAirweaveCollection';
import { useUpdateAirweaveCollection } from '../useUpdateAirweaveCollection';
import { useDeleteAirweaveCollection } from '../useDeleteAirweaveCollection';

beforeEach(resetAirweaveHookMocks);
afterEach(() => vi.clearAllMocks());

describe('useAirweaveCollectionDetail', () => {
  it('fetches and unwraps the detail envelope', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: {
          id: 'c1',
          readableId: 'acme-x-deadbeef',
          name: 'X',
          organizationId: 'org-1',
          createdAt: '',
          updatedAt: '',
          status: null,
          sourceConnectionCount: 0,
          vectorSize: 1536,
          embeddingModelName: 'text-embedding-3-large',
        },
      }),
    );
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useAirweaveCollectionDetail('acme-x-deadbeef'),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('c1');
  });

  it('does not fetch when airweaveCollectionReadableId is empty', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAirweaveCollectionDetail(''), {
      wrapper: Wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useCreateAirweaveCollection', () => {
  it('invalidates the root airweaveKeys.all on success (lists + legacy + detail consumers all refresh)', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: { id: 'c1', readableId: 'acme-y-cafefeed', name: 'Y' },
      }),
    );
    const { queryClient, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateAirweaveCollection(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({ name: 'Y' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: airweaveKeys.all });
  });
});

describe('useUpdateAirweaveCollection', () => {
  it('invalidates all + the specific detail on rename', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { id: 'c1' } }));
    const { queryClient, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateAirweaveCollection(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      airweaveCollectionReadableId: 'acme-y-cafefeed',
      input: { name: 'Renamed' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.detail('acme-y-cafefeed'),
    });
  });
});

describe('useDeleteAirweaveCollection', () => {
  it('on success: invalidates lists + removes detail/source-conns caches', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: { deleted: true, airweaveCollectionId: 'acme-y-cafefeed' },
      }),
    );
    const { queryClient, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useDeleteAirweaveCollection(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync('acme-y-cafefeed');

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: airweaveKeys.all });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.detail('acme-y-cafefeed'),
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: airweaveKeys.sourceConnections('acme-y-cafefeed'),
    });
  });
});
