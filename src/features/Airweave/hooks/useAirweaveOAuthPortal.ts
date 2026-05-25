import { useCallback } from "react";

/**
 * Open the Airweave OAuth portal in a new browser tab.
 *
 * **Security hardening (per architect HIGH #2 + ADR-011 frontend-security
 * review of Step 5):**
 *
 * 1. **noopener,noreferrer** in the `window.open` features string. Even
 *    though `<meta name="referrer" content="strict-origin">` (added in
 *    index.html / Step 0) strips the path from outbound Referer headers,
 *    `noopener` also nulls the popup's `window.opener` reference so the
 *    portal cannot navigate this tab back, and `noreferrer` strips the
 *    Referer header entirely for the popup load.
 * 2. **Discarded Window reference.** `window.open` returns a Window or
 *    null. We discard the Window so callers cannot accidentally retain
 *    a handle that survives the GC root.
 * 3. **Token-in-URL convention (v1).** Step 0 verification defaulted to
 *    query string (`?session_token=...`); URL fragment (`#session_token=...`)
 *    is the safer alternative because fragments are never sent to server
 *    logs / Referer headers, but Airweave portal fragment support was
 *    not confirmed at Step 0. If Step 0 returned query-only, callers
 *    should additionally consider whether the OAuth tab is acceptable
 *    in their security posture — see ADR-011 § Decision 3 "Query-only
 *    fallback".
 * 4. **Env-aware availability.** If `VITE_AIRWEAVE_PORTAL_URL` is unset
 *    (CI / preview / dev without OAuth wired up), the hook reports
 *    `isAvailable: false` and `open()` returns `null` without attempting
 *    to navigate. Caller renders the OAuth tab disabled with an
 *    explanatory message; direct-auth still works.
 * 5. **Popup-blocked detection.** `window.open` returns `null` when the
 *    browser blocks the popup. The caller toasts a shared "allow popups
 *    + click Reauth to retry" message via `showPopupBlockedToast()`.
 */
const PORTAL_URL = import.meta.env.VITE_AIRWEAVE_PORTAL_URL as
  | string
  | undefined;

export interface UseAirweaveOAuthPortal {
  /**
   * Open the portal in a new tab. Returns `true` on success, `false` if
   * the popup was blocked or the env var is unset.
   */
  open: (sessionToken: string) => boolean;
  /**
   * `false` when `VITE_AIRWEAVE_PORTAL_URL` is unset — caller should
   * disable the OAuth tab and explain. `true` otherwise.
   */
  isAvailable: boolean;
}

export function useAirweaveOAuthPortal(): UseAirweaveOAuthPortal {
  const isAvailable = Boolean(PORTAL_URL);

  const open = useCallback((sessionToken: string): boolean => {
    if (!PORTAL_URL) return false;
    // Query-string variant per Step 0 decision. If/when Airweave portal
    // confirms fragment support, swap `?` for `#` here AND null out the
    // fragment scrubber's query branch.
    const separator = PORTAL_URL.includes("?") ? "&" : "?";
    const url = `${PORTAL_URL}${separator}session_token=${encodeURIComponent(sessionToken)}`;
    // `noopener,noreferrer` are the load-bearing security flags. Width/
    // height are UX-only.
    const popup = window.open(
      url,
      "_blank",
      "noopener,noreferrer,width=600,height=800,resizable=yes,scrollbars=yes",
    );
    // Discard the Window reference — caller doesn't need it and retaining
    // would let later code accidentally reach the popup.
    return popup !== null;
  }, []);

  return { open, isAvailable };
}
