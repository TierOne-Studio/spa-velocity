import { useQuery } from '@tanstack/react-query';
import { listSourceConnections } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';
import type { AirweaveSourceConnection } from '../types';

/**
 * Fetch all source connections inside a collection. Per ADR-011 §
 * Amendment 2: cache invalidation after OAuth completion is driven by
 * `useAirweaveConnectModal`'s `onSuccess` callback (which calls
 * `queryClient.invalidateQueries`); `refetchOnWindowFocus` is a
 * secondary safety net for any state changes Airweave makes outside
 * our flow.
 */
export function useAirweaveSourceConnections(
  collectionReadableId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<AirweaveSourceConnection[]>({
    queryKey: airweaveKeys.sourceConnections(collectionReadableId),
    queryFn: () => listSourceConnections(collectionReadableId),
    enabled: (options?.enabled ?? true) && Boolean(collectionReadableId),
  });
}
