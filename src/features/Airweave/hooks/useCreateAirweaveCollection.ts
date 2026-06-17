import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCollection } from '../services/airweave-collections.service';
import { airweaveKeys } from './airweaveKeys';
import type {
  AirweaveCollectionDetail,
  CreateAirweaveCollectionInput,
} from '../types';

/**
 * Create a new Airweave collection. On success, invalidates ALL collection
 * lists (any active org/search scope) so both the new `/admin/airweave`
 * table and the legacy `OrganizationsPage` allowlist combobox refresh.
 *
 * `error` is `AirweaveApiError | null`; a 409 carries the orphan / collision
 * message in `.body.message` (caller surfaces verbatim per ADR-011 § 10).
 */
export function useCreateAirweaveCollection() {
  const queryClient = useQueryClient();

  return useMutation<AirweaveCollectionDetail, Error, CreateAirweaveCollectionInput>({
    mutationFn: (input) => createCollection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
    },
  });
}
