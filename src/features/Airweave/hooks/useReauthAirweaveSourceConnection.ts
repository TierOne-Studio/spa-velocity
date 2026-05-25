import { useMutation } from '@tanstack/react-query';
import { reauthSourceConnection } from '../services/source-connections.service';
import type { ReauthSourceConnectionResult } from '../types';

/**
 * Issue a fresh OAuth session token for an existing source connection.
 * The caller (`ReauthSourceConnectionButton` in Step 5) immediately
 * passes the returned `sessionToken` to `useAirweaveOAuthPortal.open(...)`
 * so the user can complete the OAuth handshake.
 *
 * Backend returns 502 BadGatewayException when the source connection's
 * `auth.method !== 'oauth_browser'` — caller surfaces the message via
 * the standard error toast. UI should also disable the button
 * client-side for non-OAuth sources to avoid the round-trip (defense in
 * depth — backend remains the source of truth).
 *
 * No `onSuccess` invalidation: this mutation produces a transient token,
 * not a state change in any cached list/detail. The list refreshes when
 * the user returns from the portal (TanStack `refetchOnWindowFocus`).
 */
export function useReauthAirweaveSourceConnection() {
  return useMutation<ReauthSourceConnectionResult, Error, string>({
    mutationFn: (sourceConnectionId) =>
      reauthSourceConnection(sourceConnectionId),
  });
}
