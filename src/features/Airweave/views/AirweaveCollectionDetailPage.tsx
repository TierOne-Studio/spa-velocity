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
  // synchronous; closure-staleness goes away. There is intentionally NO
  // accompanying useState here — the value is consumed exclusively by
  // the SDK callback (a non-render path), so render state would be
  // write-only YAGNI. If a future render-driven indicator needs the
  // token's presence, derive it from `pendingTokenRef.current` via
  // forceUpdate or add useState then.
  //
  // Unmount safety: a route change mid-OAuth can fire SDK callbacks
  // against an unmounted page. mountedRef short-circuits the writes
  // in onConnected/onCancelled AND guards getSessionToken's await
  // path (per qa-validator HIGH #3 — close failure-mode #13).
  const pendingTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
      pendingTokenRef.current = null;
    },
    [],
  );

  const connectModal = useAirweaveConnectModal({
    collectionReadableId,
    getSessionToken: async () => {
      // Re-check mount BEFORE returning — the SDK invokes us inside
      // open() so this is the right place to fail-loud on unmount,
      // not after the await resolves. (Path B per ADR-011 § Amendment 2:
      // no silent fallback to reauth.)
      if (!mountedRef.current) {
        throw new Error("Page unmounted; OAuth flow aborted.");
      }
      const t = pendingTokenRef.current;
      if (!t) {
        throw new Error(
          "No pending OAuth token — click Reauth on the row to retry.",
        );
      }
      return t;
    },
    onConnected: () => {
      if (!mountedRef.current) return;
      pendingTokenRef.current = null;
    },
    onCancelled: () => {
      if (!mountedRef.current) return;
      pendingTokenRef.current = null;
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
                  <Button size="sm" onClick={() => setAddSourceOpen(true)}>
                    <IconPlus className="mr-2 h-4 w-4" />
                    Add source
                  </Button>
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
          onOAuthSubmit={(token) => {
            // Ref-write THEN open(). Synchronous ref-write survives
            // React batching; the SDK reads pendingTokenRef inside the
            // getSessionToken closure on this same turn. See the
            // module-level lifecycle comment above.
            pendingTokenRef.current = token;
            connectModal.open();
          }}
        />
      )}
    </div>
  );
}
