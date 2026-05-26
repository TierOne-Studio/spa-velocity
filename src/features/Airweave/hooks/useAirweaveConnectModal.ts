import { useCallback, useMemo, useRef } from 'react';
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
  /**
   * Light or dark color scheme for the SDK iframe widget. The SDK
   * appends `?theme=<mode>` to the iframe URL — without it the widget
   * renders in default light mode, which on dark-mode host apps leaves
   * widget text invisible (white-on-white). Pass the host app's
   * current theme so the widget chrome matches.
   */
  theme?: 'light' | 'dark';
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

/**
 * Validate `VITE_AIRWEAVE_CONNECT_URL` at module-load. Per security-review
 * MED #1: the SDK's URL parser falls back silently to the raw string if
 * `new URL()` throws, which would weaken the postMessage origin pin to an
 * unparseable string AND, in dev, could let `http://attacker.example` be
 * silently accepted. We enforce: undefined OR https:// OR http://localhost
 * (dev only). Anything else throws at load-time so misconfig surfaces
 * immediately, not at first user click.
 *
 * Exported for unit-testability — the module-load invocation below uses
 * the same function on `import.meta.env`.
 */
export function validateConnectUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return raw;
    if (url.protocol === "http:" && url.hostname === "localhost") return raw;
    throw new Error(
      `VITE_AIRWEAVE_CONNECT_URL must be https:// (or http://localhost in dev); got: ${url.protocol}//${url.hostname}`,
    );
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `VITE_AIRWEAVE_CONNECT_URL is not a valid URL: '${raw}'`,
      );
    }
    throw err;
  }
}

const CONNECT_URL = validateConnectUrl(
  import.meta.env.VITE_AIRWEAVE_CONNECT_URL as string | undefined,
);

export function useAirweaveConnectModal({
  getSessionToken,
  collectionReadableId,
  theme,
  onConnected,
  onCancelled,
}: UseAirweaveConnectModalProps): UseAirweaveConnectModalReturn {
  const queryClient = useQueryClient();

  // Focus capture/restore (a11y HIGH from review pass — SDK iframe modal
  // does NOT trap or restore focus on its own per dist/index.js analysis).
  // We snapshot the activeElement at `open()` time and restore it when the
  // SDK reports close. Manual mitigation until the SDK ships proper
  // dialog semantics upstream.
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const restoreFocus = useCallback(() => {
    const el = triggerElementRef.current;
    triggerElementRef.current = null;
    if (el && typeof el.focus === 'function') {
      // RAF defer: SDK closes the iframe modal asynchronously; if we
      // restore focus synchronously, the iframe may still own focus and
      // the .focus() call gets dropped.
      requestAnimationFrame(() => el.focus());
    }
  }, []);

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
      restoreFocus();
    },
    [collectionReadableId, onConnected, queryClient, restoreFocus],
  );

  const handleError = useCallback(
    (error: { message?: string }) => {
      const raw = error?.message ?? 'Airweave connect failed.';
      toast.error(scrubSessionToken(raw));
      restoreFocus();
    },
    [restoreFocus],
  );

  const handleClose = useCallback(
    (reason: 'success' | 'cancel' | 'error') => {
      // success → handled by handleSuccess; error → handled by handleError.
      // (Both call restoreFocus themselves.)
      if (reason !== 'cancel') return;
      toast.message(
        'Source created in pending state — complete OAuth later via Reauth on the row, or delete the row.',
      );
      onCancelled?.();
      restoreFocus();
    },
    [onCancelled, restoreFocus],
  );

  const { open: sdkOpen, isLoading } = useAirweaveConnect({
    getSessionToken,
    connectUrl: CONNECT_URL,
    // SDK reads `theme.mode` and appends `?theme=<mode>` to the iframe
    // URL. Required for visible UI on dark-mode host apps — without it
    // the widget renders white-on-white. Only set `theme` prop when
    // caller passed a mode (omit otherwise so the SDK keeps its own
    // default behavior).
    ...(theme ? { theme: { mode: theme } } : {}),
    onSuccess: handleSuccess,
    onError: handleError,
    onClose: handleClose,
    // a11y mitigation (accessibility review HIGH): SDK modal lacks
    // dialog semantics + focus trap. `showCloseButton: true` gives
    // keyboard users a labeled close affordance (Escape still works
    // too); focus capture/restore is handled by triggerElementRef.
    showCloseButton: true,
  });

  // Capture the trigger element BEFORE opening so we can restore focus
  // to it after the SDK closes. document.activeElement during a click
  // handler is the button that fired it.
  const open = useCallback(() => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      triggerElementRef.current =
        active instanceof HTMLElement ? active : null;
    }
    sdkOpen();
  }, [sdkOpen]);

  return useMemo(() => ({ open, isLoading }), [open, isLoading]);
}
