import { useState, type ReactNode } from "react";
import { IconDotsVertical, IconEdit, IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
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
import { Badge } from "@/shared/components/ui/badge";
import { usePermissionsContext } from "@/shared/context/PermissionsContext";
import { useAirweaveSourceConnections } from "@/features/Airweave/hooks/useAirweaveSourceConnections";
import type { AirweaveSourceConnection } from "@/features/Airweave/types";
import { RenameSourceConnectionDialog } from "./RenameSourceConnectionDialog";
import { DeleteSourceConnectionDialog } from "./DeleteSourceConnectionDialog";

type Props = {
  airweaveCollectionReadableId: string;
  /**
   * Optional slot for an "Add source" affordance (button + dialog) — wired
   * in Step 4b. Step 4a renders the list-only view; this slot keeps the
   * upstream contract stable.
   */
  toolbar?: ReactNode;
  /**
   * Optional per-row action that appears between Rename and Delete in
   * the dropdown menu. Wired in Step 5 for the OAuth-only Reauth button.
   */
  renderRowExtra?: (source: AirweaveSourceConnection) => ReactNode;
};

/**
 * Source-connection list scoped to a single parent collection.
 *
 * Permission gating: row actions are HIDDEN when `can('airweave','manage-sources')`
 * is false. Per-row dropdown trigger has an `aria-label`; menu items are
 * keyboard-accessible (Radix handles arrow-key nav).
 *
 * Cross-org access is gated server-side via ADR-011 § Decision 7 inline
 * ownership checks; if the user is not in the collection's owning org,
 * the parent route's `<AdminRoute>` should already have redirected.
 */
export function SourceConnectionsList({
  airweaveCollectionReadableId,
  toolbar,
  renderRowExtra,
}: Props) {
  const { can } = usePermissionsContext();
  const canManage = can("airweave", "manage-sources");

  const [renameTarget, setRenameTarget] =
    useState<AirweaveSourceConnection | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<AirweaveSourceConnection | null>(null);

  const {
    data: sources,
    isLoading,
    isError,
    error,
  } = useAirweaveSourceConnections(airweaveCollectionReadableId);

  return (
    <div className="space-y-4">
      {toolbar && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {sources?.length ?? 0}{" "}
            {sources?.length === 1 ? "source" : "sources"}
          </div>
          <div>{toolbar}</div>
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Failed to load source connections:{" "}
          {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Entities</TableHead>
              <TableHead className="w-12" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : sources?.length
                ? sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {source.shortName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SourceStatusBadge
                          status={source.status}
                          isAuthenticated={source.isAuthenticated}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {source.entityCount}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Actions for ${source.name}`}
                              >
                                <IconDotsVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setRenameTarget(source)}
                              >
                                <IconEdit className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              {renderRowExtra?.(source)}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(source)}
                              >
                                <IconTrash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No source connections yet.
                      {canManage && toolbar
                        ? " Use the button above to add one."
                        : ""}
                    </TableCell>
                  </TableRow>
                )}
          </TableBody>
        </Table>
      </div>

      {canManage && renameTarget && (
        <RenameSourceConnectionDialog
          sourceConnection={renameTarget}
          open={Boolean(renameTarget)}
          onOpenChange={(open) => !open && setRenameTarget(null)}
        />
      )}
      {canManage && deleteTarget && (
        <DeleteSourceConnectionDialog
          sourceConnection={deleteTarget}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function SourceStatusBadge({
  status,
  isAuthenticated,
}: {
  status: string;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return <Badge variant="outline">Needs auth</Badge>;
  }
  if (status === "active" || status === "ready") {
    return <Badge>Active</Badge>;
  }
  if (status === "error") {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}
