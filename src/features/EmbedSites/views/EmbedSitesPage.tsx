import { useMemo, useState } from "react";
import {
  IconCode,
  IconDotsVertical,
  IconEdit,
  IconKey,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useProjects } from "@features/Projects";
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
import { useEmbedSites } from "../hooks/useEmbedSites";
import { CreateEmbedSiteDialog } from "../components/CreateEmbedSiteDialog";
import { EditEmbedSiteDialog } from "../components/EditEmbedSiteDialog";
import { DeleteEmbedSiteDialog } from "../components/DeleteEmbedSiteDialog";
import { RotateKeyDialog } from "../components/RotateKeyDialog";
import { EmbedCodeDialog } from "../components/EmbedCodeDialog";
import type { EmbedSite } from "../types";

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        enabled
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export function EmbedSitesPage() {
  const { can } = usePermissionsContext();
  const canCreate = can("embed-site", "create");
  const canUpdate = can("embed-site", "update");
  const canDelete = can("embed-site", "delete");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmbedSite | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmbedSite | null>(null);
  const [rotateTarget, setRotateTarget] = useState<EmbedSite | null>(null);
  const [codeTarget, setCodeTarget] = useState<EmbedSite | null>(null);

  const { data: sites, isLoading, isError, error } = useEmbedSites();
  const { data: projects } = useProjects();

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects ?? []) map.set(project.id, project.name);
    return map;
  }, [projects]);

  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4 lg:p-6"
      data-testid="embed-sites-page"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Public Widget</h1>
          <p className="text-muted-foreground">
            Create embeddable chat widgets for your public websites. Each widget
            answers from a single project's knowledge base.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create widget
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Widgets ({sites?.length ?? 0})</CardTitle>
          <CardDescription>
            Public web-chat widgets owned by this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="mb-4 text-sm text-destructive">
              Failed to load widgets:{" "}
              {error instanceof Error ? error.message : "unknown error"}
            </p>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Public key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : sites?.length ? (
                  sites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {projectNameById.get(site.projectId) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <EnabledBadge enabled={site.enabled} />
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">
                          {site.publicKey}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(site.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${site.name}`}
                            >
                              <IconDotsVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setCodeTarget(site)}>
                              <IconCode className="mr-2 h-4 w-4" />
                              Get embed code
                            </DropdownMenuItem>
                            {(canUpdate || canDelete) && <DropdownMenuSeparator />}
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => setEditTarget(site)}>
                                <IconEdit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => setRotateTarget(site)}>
                                <IconKey className="mr-2 h-4 w-4" />
                                Rotate key
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(site)}
                              >
                                <IconTrash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No widgets yet. Click Create widget to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canCreate && (
        <CreateEmbedSiteDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
      {canUpdate && editTarget && (
        <EditEmbedSiteDialog
          site={editTarget}
          open={Boolean(editTarget)}
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}
      {canUpdate && rotateTarget && (
        <RotateKeyDialog
          site={rotateTarget}
          open={Boolean(rotateTarget)}
          onOpenChange={(open) => !open && setRotateTarget(null)}
        />
      )}
      {canDelete && deleteTarget && (
        <DeleteEmbedSiteDialog
          site={deleteTarget}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
      {codeTarget && (
        <EmbedCodeDialog
          site={codeTarget}
          open={Boolean(codeTarget)}
          onOpenChange={(open) => !open && setCodeTarget(null)}
        />
      )}
    </div>
  );
}
