import { useQuery } from '@tanstack/react-query';
import { getCollection } from '../services/collections.service';
import { airweaveKeys } from './airweaveKeys';
import type { AirweaveCollectionDetail } from '../types';

/**
 * Fetch a single collection by `readable_id`. The detail page route
 * (`/admin/airweave/:collectionReadableId`) is the primary consumer.
 *
 * Surfaces upstream errors via `error: AirweaveApiError` so the page can
 * `instanceof` to render a "not found" or "not authorized" view.
 */
export function useAirweaveCollectionDetail(
  collectionReadableId: string,
  options?: { enabled?: boolean },
) {
  return useQuery<AirweaveCollectionDetail>({
    queryKey: airweaveKeys.detail(collectionReadableId),
    queryFn: () => getCollection(collectionReadableId),
    enabled: (options?.enabled ?? true) && Boolean(collectionReadableId),
  });
}
