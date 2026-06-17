import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSourceConnection } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';
import type {
  AirweaveSourceConnection,
  UpdateSourceConnectionInput,
} from '../types';

type Variables = {
  sourceConnectionId: string;
  /** Needed because the source-connection list is keyed by the parent collection. */
  airweaveCollectionReadableId: string;
  input: UpdateSourceConnectionInput;
};

/**
 * Rename a source connection. The backend gates ownership inline via its
 * parent collection — see ADR-011 § Decision 7. We invalidate only the
 * parent's source-connection list; the collection detail itself is
 * unaffected by a source-connection rename.
 */
export function useUpdateAirweaveSourceConnection() {
  const queryClient = useQueryClient();

  return useMutation<AirweaveSourceConnection, Error, Variables>({
    mutationFn: ({ sourceConnectionId, input }) =>
      updateSourceConnection(sourceConnectionId, input),
    onSuccess: (_data, { airweaveCollectionReadableId }) => {
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.sourceConnections(airweaveCollectionReadableId),
      });
    },
  });
}
