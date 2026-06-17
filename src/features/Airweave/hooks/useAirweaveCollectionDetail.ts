import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../services/airweave-collections.service';
import { airweaveKeys } from './airweaveKeys';
import type { AirweaveCollectionDetail } from '../types';

/**
 * Fetch a single collection by `readable_id`. The detail page route
 * (`/admin/airweave/:airweaveCollectionReadableId`) is the primary consumer.
 *
 * Surfaces upstream errors via `error: AirweaveApiError` so the page can
 * `instanceof` to render a "not found" or "not authorized" view.
 */
export function useAirweaveCollectionDetail(
  airweaveCollectionReadableId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<AirweaveCollectionDetail>({
    queryKey: airweaveKeys.detail(airweaveCollectionReadableId),
    queryFn: () => getCollection(airweaveCollectionReadableId),
    enabled: (options?.enabled ?? true) && Boolean(airweaveCollectionReadableId),
  });
}
