import { useQuery } from '@tanstack/react-query';
import { listSourceConnections } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';
import type { AirweaveSourceConnection } from '../types';

/**
 * Fetch all source connections inside a collection. `refetchOnWindowFocus`
 * (TanStack default `true`) is the v1 mechanism by which the detail page
 * picks up source-connection state changes after the user completes an
 * OAuth flow in a new tab — see `useAirweaveOAuthPortal` + ADR-011
 * § Decision 8.
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
