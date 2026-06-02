import { useState } from "react";
import {
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
import { useKnowledgeBases } from "../hooks/useKnowledgeBases";
import { CreateKnowledgeBaseDialog } from "../components/CreateKnowledgeBaseDialog";
import { RenameKnowledgeBaseDialog } from "../components/RenameKnowledgeBaseDialog";
import { DeleteKnowledgeBaseDialog } from "../components/DeleteKnowledgeBaseDialog";
import type { KnowledgeBase, KnowledgeBaseStatus } from "../types";

const STATUS_STYLES: Record<KnowledgeBaseStatus, string> = {
  empty:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ready:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  error:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: KnowledgeBaseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function KnowledgeBasesPage() {
  const { can } = usePermissionsContext();
  const canCreate = can("knowledge-base", "create");
  const canUpdate = can("knowledge-base", "update");
  const canDelete = can("knowledge-base", "delete");

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<KnowledgeBase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null);

  const { data: knowledgeBases, isLoading, isError, error } = useKnowledgeBases();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Bases</h1>
          <p className="text-muted-foreground">
            Upload documents to build searchable knowledge bases and attach them to
            projects for grounded chat.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Knowledge Base
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Bases ({knowledgeBases?.length ?? 0})</CardTitle>
          <CardDescription>
            Knowledge bases owned by this organization. Attach one to a project to
            enable document-grounded chat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="mb-4 text-sm text-destructive">
              Failed to load knowledge bases:{" "}
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
                  : knowledgeBases?.length
                    ? knowledgeBases.map((kb) => (
                        <TableRow key={kb.id}>
                          <TableCell>
                            <div className="font-medium">{kb.name}</div>
                            {kb.description && (
                              <div className="text-xs text-muted-foreground">
                                {kb.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={kb.status} />
                            {kb.status === "error" && kb.statusError && (
                              <p className="mt-1 text-xs text-destructive">
                                {kb.statusError}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {kb.documentCount}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(kb.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(canUpdate || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label={`Actions for ${kb.name}`}
                                  >
                                    <IconDotsVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canUpdate && (
                                    <DropdownMenuItem
                                      onClick={() => setRenameTarget(kb)}
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
                                      onClick={() => setDeleteTarget(kb)}
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
                          No knowledge bases yet. Click Create Knowledge Base to get
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
        <CreateKnowledgeBaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
      {canUpdate && renameTarget && (
        <RenameKnowledgeBaseDialog
          knowledgeBase={renameTarget}
          open={Boolean(renameTarget)}
          onOpenChange={(open) => !open && setRenameTarget(null)}
        />
      )}
      {canDelete && deleteTarget && (
        <DeleteKnowledgeBaseDialog
          knowledgeBase={deleteTarget}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
