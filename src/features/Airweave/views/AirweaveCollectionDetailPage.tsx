import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useAirweaveCollectionDetail } from "@/features/Airweave/hooks/useAirweaveCollectionDetail";
import { AirweaveApiError } from "@/features/Airweave/lib/api-response";
import { RenameCollectionDialog } from "@/features/Airweave/components/RenameCollectionDialog";
import { DeleteCollectionDialog } from "@/features/Airweave/components/DeleteCollectionDialog";
import { SourceConnectionsList } from "@/features/Airweave/components/SourceConnectionsList";
import { CreateSourceConnectionDialog } from "@/features/Airweave/components/CreateSourceConnectionDialog";
import { ReauthSourceConnectionButton } from "@/features/Airweave/components/ReauthSourceConnectionButton";
import { useAirweaveConnectModal } from "@/features/Airweave/hooks/useAirweaveConnectModal";
import { createConnectSession } from "@/features/Airweave/services/source-connections.service";

/**
 * `/admin/airweave/:collectionReadableId` — manage a single collection
 * and its source connections.
 *
 * Per ADR-011 § Decision 12: the URL parameter is the durable readable_id
 * (not the database UUID), so backend deletes/renames don't strand the
 * URL.
 *
 * Error states:
 *  - 404: collection deleted upstream; redirect via "Back" link
 *  - 403: route guard already gated by airweave:read, but a cross-org
 *    direct-link arrival lands here; surface as not-found from caller's POV
 *  - 5xx: surface the upstream message
 */
export function AirweaveCollectionDetailPage() {
  const { collectionReadableId = "" } = useParams<{
    collectionReadableId: string;
  }>();
  const navigate = useNavigate();
  const { can } = usePermissionsContext();
  const canUpdate = can("airweave", "update");
  const canDelete = can("airweave", "delete");
  const canManageSources = can("airweave", "manage-sources");

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);

  // ── OAuth modal lifecycle (lifted to page level — architect HIGH #2) ──
  //
  // The Airweave Connect SDK (@airweave/connect-react) is driven via
  // useAirweaveConnectModal mounted HERE on the page, not inside the
  // CreateSourceConnectionDialog. The dialog closes immediately after
  // the create mutation resolves; the SDK's iframe widget then handles
  // the OAuth handshake against connect.airweave.ai via postMessage.
  //
  // Ref-mirror pattern: React 18+ batches setState synchronously WITHIN
  // an event handler, so a state-based read inside the SDK's synchronous
  // getSessionToken callback would still see `null`. A ref write is
  // ADR-011 § Amendment 4 (2026-05-26): `pendingTokenRef` removed.
  // The catalog-widget flow fetches a fresh session token on every
  // `open()` call directly from `getSessionToken` — no need to stash
  // a token across the dialog→page handoff because the dialog is no
  // longer in the path. SDK widget is opened directly from the page.
  //
  // mountedRef stays: a route change mid-flow can still fire SDK
  // callbacks against an unmounted page. Short-circuit guards prevent
  // setState-after-unmount + abort the in-flight session-token fetch.
  const mountedRef = useRef(true);
  useEffect(() => {
    // Initialize on EVERY effect run, not just the initial mount.
    // React.StrictMode (dev) runs the effect → cleanup → effect again
    // immediately after mount. Without re-setting `mountedRef.current
    // = true` here, the cleanup from the first invocation flips the
    // ref to false and getSessionToken throws "Page unmounted" forever
    // even though the component is alive.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const connectModal = useAirweaveConnectModal({
    collectionReadableId,
    getSessionToken: async () => {
      // Re-check mount BEFORE the backend round-trip — the SDK invokes
      // us inside open(), so this is the right place to fail-loud on
      // unmount and avoid issuing an orphan session token. Per
      // ADR-011 § Amendment 4: every catalog-widget open() fetches a
      // fresh token (no caching) so widget always gets the live state.
      if (!mountedRef.current) {
        throw new Error("Page unmounted; aborted Airweave session fetch.");
      }
      const { sessionToken } = await createConnectSession(
        collectionReadableId,
      );
      return sessionToken;
    },
    onConnected: () => {
      // No-op when unmounted; wrapper hook handles cache invalidation
      // + success toast internally. Page-level work would happen here
      // (e.g., navigating to the new source) if needed.
    },
    onCancelled: () => {
      // Same — wrapper's cancel toast tells the user what to do next;
      // page has nothing additional to clean up since no token is
      // stashed locally anymore.
    },
  });

  const {
    data: collection,
    isLoading,
    isError,
    error,
  } = useAirweaveCollectionDetail(collectionReadableId);

  const notFound =
    isError &&
    error instanceof AirweaveApiError &&
    (error.status === 404 || error.status === 403);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
          <Link to="/admin/airweave">
            <IconArrowLeft className="mr-1 h-4 w-4" />
            Back to collections
          </Link>
        </Button>
        {isLoading ? (
          <Skeleton className="h-8 w-64" />
        ) : notFound ? (
          <h1 className="text-2xl font-bold">Collection not found</h1>
        ) : collection ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{collection.name}</h1>
              <p className="font-mono text-xs text-muted-foreground">
                {collection.readableId}
              </p>
            </div>
            {(canUpdate || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Collection actions"
                  >
                    <IconDotsVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canUpdate && (
                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                      <IconEdit className="mr-2 h-4 w-4" />
                      Rename collection
                    </DropdownMenuItem>
                  )}
                  {canUpdate && canDelete && <DropdownMenuSeparator />}
                  {canDelete && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      Delete collection
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : null}
      </div>

      {notFound ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>
              The collection <code>{collectionReadableId}</code> doesn't exist
              or isn't owned by your organization.
            </p>
            <Button asChild className="mt-4">
              <Link to="/admin/airweave">Back to collections</Link>
            </Button>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-6 text-destructive">
            Failed to load collection:{" "}
            {error instanceof Error ? error.message : "unknown error"}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Source Connections</CardTitle>
            <CardDescription>
              Data integrations powering this collection. The "Add source"
              workflow ships in the next slice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/*
              No "OAuth in progress" banner: the @airweave/connect-react
              SDK invalidates source-connection caches automatically via
              its onSuccess callback (wired in useAirweaveConnectModal).
              Per ADR-011 § Amendment 2 — postMessage transport delivers
              completion events directly, no manual-refresh affordance
              needed.
            */}
            <SourceConnectionsList
              collectionReadableId={collectionReadableId}
              toolbar={
                canManageSources ? (
                  // Primary path: catalog widget. Opens the Airweave
                  // Connect SDK with the full source picker; user
                  // chooses + authenticates inline. Per ADR-011 §
                  // Amendment 4 this is the canonical OAuth + most-
                  // direct-source entry point.
                  //
                  // Secondary "Add direct" button (advanced) is kept
                  // for users with API keys / DSNs in hand who don't
                  // want to round-trip through the widget. The shared
                  // dialog state (`addSourceOpen`) drives it.
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => connectModal.open()}
                      disabled={connectModal.isLoading}
                    >
                      <IconPlus className="mr-2 h-4 w-4" />
                      {connectModal.isLoading
                        ? "Opening…"
                        : "Connect a source"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddSourceOpen(true)}
                    >
                      Add direct source
                    </Button>
                  </div>
                ) : undefined
              }
              renderRowExtra={
                canManageSources
                  ? (source) => (
                      <ReauthSourceConnectionButton
                        key={`reauth-${source.id}`}
                        sourceConnection={source}
                      />
                    )
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {collection && canUpdate && (
        <RenameCollectionDialog
          collection={collection}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
      )}
      {collection && canDelete && (
        <DeleteCollectionDialog
          collection={collection}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => navigate("/admin/airweave")}
        />
      )}
      {canManageSources && (
        <CreateSourceConnectionDialog
          collectionReadableId={collectionReadableId}
          open={addSourceOpen}
          onOpenChange={setAddSourceOpen}
        />
      )}
    </div>
  );
}
