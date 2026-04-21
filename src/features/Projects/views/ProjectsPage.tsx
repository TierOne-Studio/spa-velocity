import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { ServerDataTable } from "@/shared/components/ui/server-data-table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { SystemViewBanner } from "@/shared/components/SystemViewBanner";
import { ViewingScopePicker } from "@/shared/components/ViewingScopePicker";
import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities";
import { useOrgScope } from "@/shared/hooks/useOrgScope";
import { useOrganizations } from "@/features/Admin/hooks/useOrganizations";

import {
  useProjects,
  useProject,
  useDeleteProject,
} from "../hooks/useProjects";
import { ProjectFormDialog } from "../components/ProjectFormDialog";
import type { ProjectSummary } from "../types";

export function ProjectsPage() {
  const { isSuperadmin, activeOrganizationId } = useOrgCapabilities();
  const scope = useOrgScope();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchValue, setSearchValue] = useState("");

  // For superadmin: `scope.mode === "all"` → cross-org view (backend gets `?scope=all`).
  // For non-superadmin: `useOrgScope` pins to the active org.
  const isScopeAll = isSuperadmin && scope.mode === "all";
  const filteredOrganizationId = isSuperadmin
    ? scope.mode === "all"
      ? undefined
      : scope.organizationId ?? undefined
    : activeOrganizationId ?? undefined;

  const { data: orgsResponse } = useOrganizations(
    { page: 1, limit: 100 },
    { enabled: isSuperadmin },
  );
  const organizations = useMemo(() => orgsResponse?.data ?? [], [orgsResponse]);
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of organizations) map.set(o.id, o.name);
    return map;
  }, [organizations]);

  const {
    data: projects,
    isLoading,
    error,
  } = useProjects({
    organizationId: filteredOrganizationId,
    scope: isScopeAll ? "all" : undefined,
  });

  const deleteProject = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  const { data: editingProject } = useProject(editingProjectId, {
    enabled: !!editingProjectId,
  });

  const filteredProjects = useMemo(() => {
    const rows = projects ?? [];
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, searchValue]);

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, pageIndex, pageSize]);

  function openCreate() {
    setEditingProjectId(null);
    setFormOpen(true);
  }

  function openEdit(p: ProjectSummary) {
    setEditingProjectId(p.id);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProject.mutateAsync({
        id: deleteTarget.id,
        organizationId: deleteTarget.organizationId,
      });
      toast.success("Project deleted.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete project.",
      );
    }
  }

  const columns = useMemo<ColumnDef<ProjectSummary>[]>(() => {
    const cols: ColumnDef<ProjectSummary>[] = [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium" data-testid={`project-name-${row.original.id}`}>
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1">
            {row.original.description ?? "—"}
          </span>
        ),
      },
    ];

    if (isSuperadmin) {
      cols.push({
        id: "organization",
        header: "Organization",
        cell: ({ row }) =>
          orgNameById.get(row.original.organizationId) ?? row.original.organizationId,
      });
    }

    cols.push(
      {
        id: "sources",
        header: "Sources",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.sourceCount}</Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Row actions"
                data-testid={`project-row-actions-${row.original.id}`}
              >
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => openEdit(row.original)}
                data-testid={`project-edit-${row.original.id}`}
              >
                <IconEdit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTarget(row.original)}
                data-testid={`project-delete-${row.original.id}`}
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    );

    return cols;
  }, [isSuperadmin, orgNameById]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6" data-testid="projects-page">
      <SystemViewBanner visible={isSuperadmin && scope.mode === "all"} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Group chats and their data sources by project.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load projects."}
        </div>
      )}

      <ServerDataTable
        columns={columns}
        data={pageRows}
        total={filteredProjects.length}
        pageSize={pageSize}
        pageIndex={pageIndex}
        isLoading={isLoading}
        searchPlaceholder="Search projects..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value);
          setPageIndex(0);
        }}
        onPageChange={setPageIndex}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageIndex(0);
        }}
        getRowId={(row) => row.id}
        toolbar={
          <div className="flex items-center gap-2">
            <ViewingScopePicker
              value={scope.selectedValue}
              onChange={(value) => {
                scope.setSelectedValue(value);
                setPageIndex(0);
              }}
              organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
              className="w-[220px]"
              placeholder="All organizations"
            />
            <Button onClick={openCreate} data-testid="projects-new-button">
              <IconPlus className="mr-2 h-4 w-4" />
              New project
            </Button>
          </div>
        }
      />

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingProjectId(null);
        }}
        project={editingProjectId ? editingProject ?? null : null}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project, its data-source attachments and any
              conversations owned by it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-white hover:bg-destructive/90"
              data-testid="project-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
