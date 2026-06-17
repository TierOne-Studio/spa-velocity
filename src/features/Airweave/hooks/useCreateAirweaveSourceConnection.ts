import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSourceConnection } from '../services/source-connections.service';
import { airweaveKeys } from './airweaveKeys';
import type {
  CreateSourceConnectionInput,
  CreateSourceConnectionResult,
} from '../types';

type Variables = {
  airweaveCollectionReadableId: string;
  input: CreateSourceConnectionInput;
};

/**
 * Create a source connection inside a collection. Discriminated by
 * `input.authentication.kind`:
 *
 *  - `'direct'`: server creates synchronously + kicks off the initial sync;
 *    `result.sessionToken` is `undefined`.
 *  - `'oauth'`: server creates pending + returns a `sessionToken`. The
 *    caller (`CreateSourceConnectionDialog` OAuth tab) hands the token
 *    up to `AirweaveCollectionDetailPage` via `onOAuthSubmit`, which
 *    drives the SDK-powered modal via `useAirweaveConnectModal`. Per
 *    ADR-011 § Amendment 2: postMessage transport via
 *    `@airweave/connect-react`, not window.open.
 *
 * On success invalidates the parent collection's source-connection list
 * AND the collection detail (because `sourceConnectionCount` changed).
 */
export function useCreateAirweaveSourceConnection() {
  const queryClient = useQueryClient();

  return useMutation<CreateSourceConnectionResult, Error, Variables>({
    mutationFn: ({ airweaveCollectionReadableId, input }) =>
      createSourceConnection(airweaveCollectionReadableId, input),
    onSuccess: (_data, { airweaveCollectionReadableId }) => {
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.sourceConnections(airweaveCollectionReadableId),
      });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(airweaveCollectionReadableId),
      });
      // Also invalidate lists so the table's `sourceConnectionCount` column
      // refreshes if the user navigates back to /admin/airweave.
      queryClient.invalidateQueries({ queryKey: airweaveKeys.all });
    },
  });
}
