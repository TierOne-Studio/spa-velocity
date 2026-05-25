import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAirweaveConnect } from '@airweave/connect-react';
import { toast } from 'sonner';
import { airweaveKeys } from './airweaveKeys';
import { scrubSessionToken } from '../lib/scrub-session-token';

/**
 * Thin wrapper around `@airweave/connect-react`'s `useAirweaveConnect`.
 *
 * Responsibilities:
 *  - Plumb `VITE_AIRWEAVE_CONNECT_URL` to the SDK's `connectUrl` prop
 *    (undefined → SDK uses default `https://connect.airweave.ai`).
 *  - Translate SDK callbacks into our cache invalidation + toast UX
 *    per ADR-011 § Amendment 2 (postMessage transport, no URL leakage).
 *  - Keep `getSessionToken` opaque — the caller owns whether the token
 *    comes from a cached create-response or a fresh reauth call.
 *
 * Lifecycle note: this hook MUST be called from a component that survives
 * the OAuth modal's entire lifecycle (open → user interaction → close).
 * Inside a dialog that unmounts on close, the hook would die mid-flow.
 * Per the airweave plan Step 5, the create-flow call site is the page
 * (`AirweaveCollectionDetailPage`), not the dialog itself. The Reauth
 * button's call site IS the row inside the still-mounted page table —
 * also safe.
 *
 * Token staleness (Path B per amended plan): if `getSessionToken` returns
 * a stale token (>10 min TTL), the SDK fires `onError`. We toast the
 * scrubbed message and stop. The caller's recovery path is the Reauth
 * row action — NOT a silent fallback inside this wrapper.
 */
export interface UseAirweaveConnectModalProps {
  /** Backend call that returns a fresh session token (create or reauth). */
  getSessionToken: () => Promise<string>;
  /** Used to invalidate the right cache slice on successful connect. */
  collectionReadableId: string;
  /** Optional — fires after the SDK reports success AND cache invalidation. */
  onConnected?: (connectionId: string) => void;
  /**
   * Optional — fires when user cancels the modal (the source-connection
   * record may still be in pending state upstream; caller decides what
   * to do).
   */
  onCancelled?: () => void;
}

export interface UseAirweaveConnectModalReturn {
  /** Open the Airweave Connect modal. SDK calls `getSessionToken` on each invocation. */
  open: () => void;
  /** True while the SDK is awaiting the session token from `getSessionToken`. */
  isLoading: boolean;
}

const CONNECT_URL = import.meta.env.VITE_AIRWEAVE_CONNECT_URL as
  | string
  | undefined;

export function useAirweaveConnectModal({
  getSessionToken,
  collectionReadableId,
  onConnected,
  onCancelled,
}: UseAirweaveConnectModalProps): UseAirweaveConnectModalReturn {
  const queryClient = useQueryClient();

  const handleSuccess = useCallback(
    (connectionId: string) => {
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.sourceConnections(collectionReadableId),
      });
      queryClient.invalidateQueries({
        queryKey: airweaveKeys.detail(collectionReadableId),
      });
      toast.success('Source connection authenticated.');
      onConnected?.(connectionId);
    },
    [collectionReadableId, onConnected, queryClient],
  );

  const handleError = useCallback((error: { message?: string }) => {
    const raw = error?.message ?? 'Airweave connect failed.';
    toast.error(scrubSessionToken(raw));
  }, []);

  const handleClose = useCallback(
    (reason: 'success' | 'cancel' | 'error') => {
      // success → handled by handleSuccess; error → handled by handleError.
      // Cancel is the only branch that needs explicit UX here.
      if (reason !== 'cancel') return;
      toast.message(
        'Source created in pending state — complete OAuth later via Reauth on the row, or delete the row.',
      );
      onCancelled?.();
    },
    [onCancelled],
  );

  const { open, isLoading } = useAirweaveConnect({
    getSessionToken,
    connectUrl: CONNECT_URL,
    onSuccess: handleSuccess,
    onError: handleError,
    onClose: handleClose,
  });

  return useMemo(() => ({ open, isLoading }), [open, isLoading]);
}
