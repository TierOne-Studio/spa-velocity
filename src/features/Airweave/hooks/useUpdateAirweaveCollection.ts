import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCollection } from '../services/collections.service';
import { airweaveKeys } from './airweaveKeys';
import type {
  AirweaveCollectionDetail,
  UpdateCollectionInput,
} from '../types';

type Variables = {
  collectionReadableId: string;
  input: UpdateCollectionInput;
};

/**
 * Rename an Airweave collection. Invalidates BOTH the list (so the table
 * picks up the new name) AND the specific detail (so the detail page
 * header refreshes). Per ADR-011 § Decision 13 (URL convention): the
 * `collectionReadableId` is immutable on rename — only `name` changes —
 * so the detail-page URL parameter remains valid after this mutation.
 */
export function useUpdateAirweaveCollection() {
  const queryClient = useQueryClient();

  return useMutation<AirweaveCollectionDetail, Error, Variables>({
    mutationFn: ({ collectionReadableId, input }) =>
      updateCollection(collectionReadableId, input),
    onSuccess: (_data, { collectionReadableId }) => {
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(collectionReadableId),
      });
    },
  });
}
