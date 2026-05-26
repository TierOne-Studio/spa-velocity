import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteSourceConnection } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';

type Variables = {
  sourceConnectionId: string;
  collectionReadableId: string;
};

/**
 * Delete a source connection. Backend cancels any in-flight sync
 * server-side per ADR-011 assumption A5.
 *
 * Invalidates the parent's source-connection list AND the collection
 * detail (because `sourceConnectionCount` decreases).
 */
export function useDeleteAirweaveSourceConnection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, Variables>({
    mutationFn: ({ sourceConnectionId }) =>
      deleteSourceConnection(sourceConnectionId),
    onSuccess: (_data, { collectionReadableId }) => {
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.sourceConnections(collectionReadableId),
      });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(collectionReadableId),
      });
      // List view shows sourceConnectionCount — refresh that too.
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
    },
  });
}
