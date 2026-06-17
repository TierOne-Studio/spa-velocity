import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCollection } from '../services/airweave-collections.service';
import { airweaveKeys } from './airweaveKeys';
import type {
  AirweaveCollectionDetail,
  UpdateAirweaveCollectionInput,
} from '../types';

type Variables = {
  airweaveCollectionReadableId: string;
  input: UpdateAirweaveCollectionInput;
};

/**
 * Rename an Airweave collection. Invalidates BOTH the list (so the table
 * picks up the new name) AND the specific detail (so the detail page
 * header refreshes). Per ADR-011 § Decision 13 (URL convention): the
 * `airweaveCollectionReadableId` is immutable on rename — only `name` changes —
 * so the detail-page URL parameter remains valid after this mutation.
 */
export function useUpdateAirweaveCollection() {
  const queryClient = useQueryClient();

  return useMutation<AirweaveCollectionDetail, Error, Variables>({
    mutationFn: ({ airweaveCollectionReadableId, input }) =>
      updateCollection(airweaveCollectionReadableId, input),
    onSuccess: (_data, { airweaveCollectionReadableId }) => {
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(airweaveCollectionReadableId),
      });
    },
  });
}
