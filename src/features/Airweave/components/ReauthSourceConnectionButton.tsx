import { toast } from "sonner";
import { IconRefresh } from "@tabler/icons-react";
import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";
import { useReauthAirweaveSourceConnection } from "@/features/Airweave/hooks/useReauthAirweaveSourceConnection";
import { useAirweaveOAuthPortal } from "@/features/Airweave/hooks/useAirweaveOAuthPortal";
import { scrubSessionToken } from "@/features/Airweave/lib/scrub-session-token";
import { showPopupBlockedToast } from "@/features/Airweave/lib/popup-blocked-toast";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";

type Props = {
  sourceConnection: AirweaveSourceConnection;
  onPortalOpened?: () => void;
};

/**
 * Per-row Reauth menu item. Renders as a `DropdownMenuItem` so it slots
 * into `SourceConnectionsList`'s `renderRowExtra`.
 *
 * Client-side gating (defense in depth — backend remains source of
 * truth):
 *  - Hidden for sources whose `auth.method !== 'oauth_browser'`. Backend
 *    returns 502 if the SPA still calls reauth on them; this prevents
 *    the round-trip.
 *  - Hidden when the portal helper reports `isAvailable: false`
 *    (VITE_AIRWEAVE_PORTAL_URL unset). Caller toasts an explanatory
 *    error if `open()` returns false anyway.
 *
 * On success, calls `onPortalOpened` so the detail page can render the
 * persistent "OAuth in progress" banner.
 */
export function ReauthSourceConnectionButton({
  sourceConnection,
  onPortalOpened,
}: Props) {
  const reauthMutation = useReauthAirweaveSourceConnection();
  const portal = useAirweaveOAuthPortal();

  // Defense-in-depth visibility filter — see JSDoc.
  if (!portal.isAvailable) return null;
  if (sourceConnection.authMethod !== "oauth_browser") return null;

  const handleClick = async (event: Event) => {
    // Prevent the menu from closing before mutateAsync resolves so the
    // user can see the spinner via the disabled state if we wanted —
    // simple v1: let it close and show the toast on completion.
    event.preventDefault();
    try {
      const { sessionToken } = await reauthMutation.mutateAsync(
        sourceConnection.id,
      );
      const opened = portal.open(sessionToken);
      if (!opened) {
        showPopupBlockedToast();
        return;
      }
      onPortalOpened?.();
      toast.success("Re-auth started — complete the flow in the new tab.");
    } catch (error) {
      const message =
        error instanceof Error
          ? scrubSessionToken(error.message)
          : "Failed to start re-auth";
      toast.error(message);
    }
  };

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // Run async work outside React's event sync boundary.
        void handleClick(event);
      }}
      disabled={reauthMutation.isPending}
    >
      <IconRefresh className="mr-2 h-4 w-4" />
      Re-authenticate
    </DropdownMenuItem>
  );
}
