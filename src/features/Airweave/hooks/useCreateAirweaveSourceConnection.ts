import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSourceConnection } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';
import type {
  CreateSourceConnectionInput,
  CreateSourceConnectionResult,
} from '../types';

type Variables = {
  collectionReadableId: string;
  input: CreateSourceConnectionInput;
};

/**
 * Create a source connection inside a collection. Discriminated by
 * `input.authentication.kind`:
 *
 *  - `'direct'`: server creates synchronously + kicks off the initial sync;
 *    `result.sessionToken` is `undefined`.
 *  - `'oauth'`: server creates pending + returns a `sessionToken`. The
 *    caller (`CreateSourceConnectionDialog` Step 5 OAuth tab) passes the
 *    token to `useAirweaveOAuthPortal.open(token)` to launch the browser
 *    OAuth handshake.
 *
 * On success invalidates the parent collection's source-connection list
 * AND the collection detail (because `sourceConnectionCount` changed).
 */
export function useCreateAirweaveSourceConnection() {
  const queryClient = useQueryClient();

  return useMutation<CreateSourceConnectionResult, Error, Variables>({
    mutationFn: ({ collectionReadableId, input }) =>
      createSourceConnection(collectionReadableId, input),
    onSuccess: (_data, { collectionReadableId }) => {
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.sourceConnections(collectionReadableId),
      });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(collectionReadableId),
      });
      // Also invalidate lists so the table's `sourceConnectionCount` column
      // refreshes if the user navigates back to /admin/airweave.
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
    },
  });
}
