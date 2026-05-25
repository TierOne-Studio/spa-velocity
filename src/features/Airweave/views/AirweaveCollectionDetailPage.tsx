import { useState } from "react";
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
          <CardContent>
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
