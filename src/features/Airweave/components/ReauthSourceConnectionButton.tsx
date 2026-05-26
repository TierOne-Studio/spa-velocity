import { IconRefresh } from "@tabler/icons-react";
import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";
import { useReauthAirweaveSourceConnection } from "@/features/Airweave/hooks/useReauthAirweaveSourceConnection";
import { useAirweaveConnectModal } from "@/features/Airweave/hooks/useAirweaveConnectModal";
import { useTheme } from "@/shared/components/ui/theme-provider";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";

type Props = {
  sourceConnection: AirweaveSourceConnection;
};

/**
 * Per-row Reauth menu item. Renders as a `DropdownMenuItem` so it slots
 * into `SourceConnectionsList`'s `renderRowExtra`.
 *
 * Click → `useAirweaveConnectModal.open()` → SDK invokes our
 * `getSessionToken` which calls the backend reauth endpoint to mint a
 * fresh sessionToken → SDK opens the Airweave Connect iframe widget for
 * the OAuth handshake. Per ADR-011 § Amendment 2 — postMessage transport,
 * not window.open.
 *
 * Defense-in-depth visibility filter (backend remains source of truth):
 *  - Hidden for sources whose `authMethod !== 'oauth_browser'`. Backend
 *    returns 502 if the SPA still calls reauth on them; this prevents
 *    the round-trip.
 *
 * Lifecycle: the button lives inside a row inside a table inside the
 * detail page — the page is alive during the entire OAuth flow, so the
 * `useAirweaveConnectModal` hook here is safe (unlike the create-flow
 * which had to lift to the page level because the dialog unmounts).
 */
export function ReauthSourceConnectionButton({ sourceConnection }: Props) {
  const reauthMutation = useReauthAirweaveSourceConnection();
  // Match the host theme so the SDK widget chrome doesn't render
  // invisible (see useAirweaveConnectModal docstring + Amendment 4
  // theme-wiring on the detail page). Same resolution rule: respect
  // explicit light|dark, fall back to matchMedia for `system`.
  const { theme: hostTheme } = useTheme();
  const widgetTheme: "light" | "dark" =
    hostTheme === "dark"
      ? "dark"
      : hostTheme === "light"
        ? "light"
        : typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  const connectModal = useAirweaveConnectModal({
    collectionReadableId: sourceConnection.collectionReadableId,
    theme: widgetTheme,
    getSessionToken: async () => {
      const result = await reauthMutation.mutateAsync(sourceConnection.id);
      return result.sessionToken;
    },
  });

  if (sourceConnection.authMethod !== "oauth_browser") return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // Prevent the menu from closing before the modal opens — keeps
        // focus management consistent. The SDK's getSessionToken triggers
        // the reauth mutation; error/cancel/success surface via
        // useAirweaveConnectModal's own toast wiring.
        event.preventDefault();
        connectModal.open();
      }}
      disabled={reauthMutation.isPending || connectModal.isLoading}
    >
      <IconRefresh className="mr-2 h-4 w-4" />
      Re-authenticate
    </DropdownMenuItem>
  );
}
