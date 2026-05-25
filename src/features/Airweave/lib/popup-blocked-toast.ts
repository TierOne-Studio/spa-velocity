import { toast } from "sonner";

/**
 * Shared `window.open`-returned-null handler.
 *
 * Both the create-OAuth submit path and the per-row Reauth button hit
 * this when the user's browser blocks the popup. The copy is
 * intentionally identical so the user sees a stable message regardless
 * of entry point. Per the airweave plan Step 5 security hardening:
 *  - The create-OAuth dialog does NOT show a banner in this case
 *    (banner = success state). The dialog stays open / closes per its
 *    own logic; the user retries via the row's Reauth button.
 *  - The Reauth button caller simply surfaces this toast and stops.
 */
export function showPopupBlockedToast(): void {
  toast.error(
    "Allow popups for this site to complete the OAuth flow, then click Reauth on the source connection to retry.",
  );
}
