import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconDotsVertical,
  IconPlus,
  IconEdit,
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
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useAirweaveCollections } from "@/features/Admin/hooks/useAirweaveCollections";
import type { AirweaveCollection } from "@/features/Airweave/types";
import { CreateAirweaveCollectionDialog } from "@/features/Airweave/components/CreateAirweaveCollectionDialog";
import { RenameAirweaveCollectionDialog } from "@/features/Airweave/components/RenameAirweaveCollectionDialog";
import { DeleteAirweaveCollectionDialog } from "@/features/Airweave/components/DeleteAirweaveCollectionDialog";

/**
 * `/admin/airweave` — manage Airweave collections owned by the active
 * organization. Members see a read-only list (silent-filtered by the
 * backend allowlist); admins/managers see the Create button and per-row
 * Rename / Delete actions per their `airweave:*` permissions.
 *
 * Mutation buttons are HIDDEN (not disabled) when `can()` returns false —
 * matches OrganizationsPage convention. Route-level gate is in
 * AppRoutes.tsx (`requiredPermission={airweave:read}`).
 */
export function AirweaveCollectionsPage() {
  const navigate = useNavigate();
  const { can } = usePermissionsContext();
  const canCreate = can("airweave", "create");
  const canUpdate = can("airweave", "update");
  const canDelete = can("airweave", "delete");

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AirweaveCollection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AirweaveCollection | null>(null);

  const {
    data: collections,
    isLoading,
    isError,
    error,
  } = useAirweaveCollections({ search });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Airweave Collections</h1>
          <p className="text-muted-foreground">
            Manage Airweave collections and their source connections for this organization.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Airweave Collection
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Airweave Collections ({collections?.length ?? 0})</CardTitle>
          <CardDescription>
            Click a row to manage source connections. Only collections owned by
            this organization are listed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search Airweave Collections"
          />

          {isError && (
            <p className="text-sm text-destructive">
              Failed to load Airweave Collections:{" "}
              {error instanceof Error ? error.message : "unknown error"}
            </p>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Readable ID</TableHead>
                  <TableHead className="text-right">Sources</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : collections?.length
                    ? collections.map((collection) => (
                        <TableRow
                          key={collection.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            navigate(
                              `/admin/airweave/${encodeURIComponent(collection.readableId)}`,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(
                                `/admin/airweave/${encodeURIComponent(collection.readableId)}`,
                              );
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`Manage Airweave Collection ${collection.name}`}
                        >
                          <TableCell className="font-medium">{collection.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {collection.readableId}
                          </TableCell>
                          <TableCell className="text-right">
                            {collection.sourceConnectionCount}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(collection.createdAt).toLocaleDateString()}
                          </TableCell>
                          {/*
                            Stop click propagation at the actions cell so
                            opening the dropdown / selecting a menu item
                            doesn't ALSO fire the row's onClick → navigate
                            handler. The trigger's own onClick stopPropagation
                            isn't sufficient because Radix's `asChild` slot
                            composition fires the row click first in some
                            event paths (caught by e2e
                            airweave/collections-crud.spec.ts).
                          */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(canUpdate || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label={`Actions for ${collection.name}`}
                                  >
                                    <IconDotsVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canUpdate && (
                                    <DropdownMenuItem
                                      onClick={() => setRenameTarget(collection)}
                                    >
                                      <IconEdit className="mr-2 h-4 w-4" />
                                      Rename
                                    </DropdownMenuItem>
                                  )}
                                  {canUpdate && canDelete && <DropdownMenuSeparator />}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteTarget(collection)}
                                    >
                                      <IconTrash className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {search
                            ? "No Airweave Collections match that search."
                            : "No Airweave Collections yet. Click Create Airweave Collection to get started."}
                        </TableCell>
                      </TableRow>
                    )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canCreate && (
        <CreateAirweaveCollectionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
      {canUpdate && renameTarget && (
        <RenameAirweaveCollectionDialog
          collection={renameTarget}
          open={Boolean(renameTarget)}
          onOpenChange={(open) => !open && setRenameTarget(null)}
        />
      )}
      {canDelete && deleteTarget && (
        <DeleteAirweaveCollectionDialog
          collection={deleteTarget}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
