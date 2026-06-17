import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteSourceConnection } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';

type Variables = {
  sourceConnectionId: string;
  airweaveCollectionReadableId: string;
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
    onSuccess: (_data, { airweaveCollectionReadableId }) => {
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.sourceConnections(airweaveCollectionReadableId),
      });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(airweaveCollectionReadableId),
      });
      // List view shows sourceConnectionCount — refresh that too.
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
    },
  });
}
