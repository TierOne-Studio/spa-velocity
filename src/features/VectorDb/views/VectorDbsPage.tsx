import { useState } from "react";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUpload,
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
import { useVectorDbs } from "../hooks/useVectorDbs";
import { CreateVectorDbDialog } from "../components/CreateVectorDbDialog";
import { RenameVectorDbDialog } from "../components/RenameVectorDbDialog";
import { DeleteVectorDbDialog } from "../components/DeleteVectorDbDialog";
import { UploadDocumentDialog } from "../components/UploadDocumentDialog";
import type { VectorDb, VectorDbStatus } from "../types";

const STATUS_STYLES: Record<VectorDbStatus, string> = {
  empty:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ready:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  error:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: VectorDbStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function VectorDbsPage() {
  const { can } = usePermissionsContext();
  const canCreate = can("vector-db", "create");
  const canUpdate = can("vector-db", "update");
  const canDelete = can("vector-db", "delete");
  const canUpload = can("vector-db", "upload");

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<VectorDb | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VectorDb | null>(null);
  const [uploadTarget, setUploadTarget] = useState<VectorDb | null>(null);

  const { data: vectorDbs, isLoading, isError, error } = useVectorDbs();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vector Databases</h1>
          <p className="text-muted-foreground">
            Upload documents to build searchable vector databases and attach them to
            projects for grounded chat.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Vector Database
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vector Databases ({vectorDbs?.length ?? 0})</CardTitle>
          <CardDescription>
            Vector databases owned by this organization. Attach one to a project to
            enable document-grounded chat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="mb-4 text-sm text-destructive">
              Failed to load vector databases:{" "}
              {error instanceof Error ? error.message : "unknown error"}
            </p>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Documents</TableHead>
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
                  : vectorDbs?.length
                    ? vectorDbs.map((vdb) => (
                        <TableRow key={vdb.id}>
                          <TableCell>
                            <div className="font-medium">{vdb.name}</div>
                            {vdb.description && (
                              <div className="text-xs text-muted-foreground">
                                {vdb.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={vdb.status} />
                            {vdb.status === "error" && vdb.statusError && (
                              <p className="mt-1 text-xs text-destructive">
                                {vdb.statusError.message}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {vdb.documentCount}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(vdb.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(canUpload || canUpdate || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label={`Actions for ${vdb.name}`}
                                  >
                                    <IconDotsVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canUpload && (
                                    <DropdownMenuItem
                                      onClick={() => setUploadTarget(vdb)}
                                    >
                                      <IconUpload className="mr-2 h-4 w-4" />
                                      Upload document
                                    </DropdownMenuItem>
                                  )}
                                  {canUpload && (canUpdate || canDelete) && (
                                    <DropdownMenuSeparator />
                                  )}
                                  {canUpdate && (
                                    <DropdownMenuItem
                                      onClick={() => setRenameTarget(vdb)}
                                    >
                                      <IconEdit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canUpdate && canDelete && (
                                    <DropdownMenuSeparator />
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteTarget(vdb)}
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
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8"
                        >
                          No vector databases yet. Click Create Vector Database to get
                          started.
                        </TableCell>
                      </TableRow>
                    )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canCreate && (
        <CreateVectorDbDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
      {canUpdate && renameTarget && (
        <RenameVectorDbDialog
          vectordb={renameTarget}
          open={Boolean(renameTarget)}
          onOpenChange={(open) => !open && setRenameTarget(null)}
        />
      )}
      {canDelete && deleteTarget && (
        <DeleteVectorDbDialog
          vectordb={deleteTarget}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
      {canUpload && uploadTarget && (
        <UploadDocumentDialog
          vectordb={uploadTarget}
          open={Boolean(uploadTarget)}
          onOpenChange={(open) => !open && setUploadTarget(null)}
        />
      )}
    </div>
  );
}
