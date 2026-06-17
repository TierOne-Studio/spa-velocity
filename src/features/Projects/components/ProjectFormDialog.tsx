import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  MultiSelectCombobox,
  type MultiSelectOption,
} from "@/shared/components/ui/multi-select-combobox";
import { OrgTargetField } from "@/shared/components/forms/OrgTargetField";
import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities";
import {
  useOrganization,
  useOrganizations,
} from "@/features/Admin/hooks/useOrganizations";
import { useAirweaveCollections } from "@/features/Admin/hooks/useAirweaveCollections";
import { useSqlConnections } from "@/features/Admin/hooks/useSqlConnections";
import { useVectorDbs } from "@/features/VectorDb/hooks/useVectorDbs";

import {
  useCreateProject,
  useUpdateProject,
  useAddProjectSource,
  useRemoveProjectSource,
} from "../hooks/useProjects";
import type {
  CreateDataSourceInput,
  ProjectDetail,
  ProjectDataSource,
} from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectDetail | null;
};

function readAllowedAirweaveCollectionIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as { allowedAirweaveCollectionIds?: unknown })
    .allowedAirweaveCollectionIds;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }
  return [];
}

function getAirweaveCollectionIds(sources: ProjectDataSource[]): string[] {
  return sources
    .filter((s): s is ProjectDataSource & { kind: "airweave_collection" } =>
      s.kind === "airweave_collection",
    )
    .map((s) => s.config.airweaveCollectionReadableId);
}

function getAirweaveSourceIdByReadableId(
  sources: ProjectDataSource[],
  readableId: string,
): string | null {
  const match = sources.find(
    (s) =>
      s.kind === "airweave_collection" &&
      s.config.airweaveCollectionReadableId === readableId,
  );
  return match ? match.id : null;
}

function getDatabaseConnectionIds(sources: ProjectDataSource[]): string[] {
  return sources
    .filter((s): s is ProjectDataSource & { kind: "database" } =>
      s.kind === "database",
    )
    .map((s) => s.config.connectionId)
    .filter((id) => id.length > 0);
}

function getDatabaseSourceIdByConnectionId(
  sources: ProjectDataSource[],
  connectionId: string,
): string | null {
  const match = sources.find(
    (s): s is ProjectDataSource & { kind: "database" } =>
      s.kind === "database" && s.config.connectionId === connectionId,
  );
  return match ? match.id : null;
}

function getVectorDbIds(sources: ProjectDataSource[]): string[] {
  return sources
    .filter((s): s is ProjectDataSource & { kind: "vector_db" } =>
      s.kind === "vector_db",
    )
    .map((s) => s.config.vectorDbId)
    .filter((id) => id.length > 0);
}

function getVectorDbSourceIdByVectorDbId(
  sources: ProjectDataSource[],
  vectorDbId: string,
): string | null {
  const match = sources.find(
    (s): s is ProjectDataSource & { kind: "vector_db" } =>
      s.kind === "vector_db" && s.config.vectorDbId === vectorDbId,
  );
  return match ? match.id : null;
}

export function ProjectFormDialog({ open, onOpenChange, project }: Props) {
  const isEdit = !!project;
  const { isSuperadmin, activeOrganizationId: activeOrgId } = useOrgCapabilities();

  const { data: orgsResponse } = useOrganizations(
    { page: 1, limit: 100 },
    { enabled: isSuperadmin && open },
  );
  const organizations = useMemo(() => orgsResponse?.data ?? [], [orgsResponse]);

  const { data: collections, isLoading: collectionsLoading } = useAirweaveCollections({
    enabled: open,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [selectedAirweaveCollectionIds, setSelectedAirweaveCollectionIds] = useState<string[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [selectedVectorDbIds, setSelectedVectorDbIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setOrganizationId(project.organizationId);
      setSelectedAirweaveCollectionIds(getAirweaveCollectionIds(project.sources));
      setSelectedConnectionIds(getDatabaseConnectionIds(project.sources));
      setSelectedVectorDbIds(getVectorDbIds(project.sources));
    } else {
      setName("");
      setDescription("");
      setOrganizationId(activeOrgId);
      setSelectedAirweaveCollectionIds([]);
      setSelectedConnectionIds([]);
      setSelectedVectorDbIds([]);
    }
  }, [open, project, activeOrgId]);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const addSource = useAddProjectSource();
  const removeSource = useRemoveProjectSource();

  // Superadmin: selectedOrg comes from the full orgs list (it has metadata).
  // Non-superadmin: the orgs list query is disabled, so fall back to fetching
  // the single organization by id to read its metadata-driven allowlist.
  const { data: selectedOrgFull } = useOrganization(
    !isSuperadmin && open && organizationId ? organizationId : "",
  );

  const selectedOrg = useMemo(() => {
    const fromList = organizations.find((o) => o.id === organizationId);
    if (fromList) return fromList;
    if (selectedOrgFull && selectedOrgFull.id === organizationId) {
      return selectedOrgFull;
    }
    return undefined;
  }, [organizations, organizationId, selectedOrgFull]);

  const allowedAirweaveCollectionIds = useMemo(() => {
    if (isSuperadmin) return null;
    if (selectedOrg) return readAllowedAirweaveCollectionIds(selectedOrg.metadata);
    return null;
  }, [isSuperadmin, selectedOrg]);

  const collectionOptions = useMemo<MultiSelectOption[]>(() => {
    const list = collections ?? [];
    const allowed = allowedAirweaveCollectionIds;
    const filtered = allowed ? list.filter((c) => allowed.includes(c.readableId)) : list;
    return filtered.map((c) => ({
      value: c.readableId,
      label: c.name,
      description: c.readableId,
    }));
  }, [collections, allowedAirweaveCollectionIds]);

  const { data: sqlConnections, isLoading: sqlConnectionsLoading } = useSqlConnections(
    organizationId ?? undefined,
    { enabled: open && Boolean(organizationId) },
  );

  const sqlConnectionOptions = useMemo<MultiSelectOption[]>(() => {
    const connections = sqlConnections ?? [];
    // Include `ready` connections plus any already-attached non-ready ones so
    // edit mode can still render + remove them. Without this, a connection
    // that transitions to `connecting`/`error` after being attached would
    // disappear from the combobox while still living in `selectedConnectionIds`.
    const selectedSet = new Set(selectedConnectionIds);
    return connections
      .filter((c) => c.status === "ready" || selectedSet.has(c.id))
      .map((c) => ({
        value: c.id,
        label: c.name,
        description:
          c.status === "ready"
            ? `${c.username}@${c.host}:${c.port}/${c.database}`
            : `${c.username}@${c.host}:${c.port}/${c.database} — ${c.status}`,
      }));
  }, [sqlConnections, selectedConnectionIds]);

  // `useVectorDbs` is scoped to the caller's active organization (like
  // `useAirweaveCollections`), so the list reflects the active org. For a
  // superadmin who targets a different org, the API still rejects a cross-org
  // attach (404), so this is a benign list-staleness, not a correctness hole.
  const { data: vectorDbsData, isLoading: vectorDbsLoading } = useVectorDbs();

  const vectorDbOptions = useMemo<MultiSelectOption[]>(() => {
    // Show every vector database (not just `ready`): one legitimately starts
    // `empty` and becomes searchable after ingestion, so users must be able to
    // attach it ahead of time. Surface the status so the readiness is visible.
    return (vectorDbsData ?? []).map((db) => ({
      value: db.id,
      label: db.name,
      description: db.status === "ready" ? "ready" : db.status,
    }));
  }, [vectorDbsData]);

  const isSubmitting =
    createProject.isPending ||
    updateProject.isPending ||
    addSource.isPending ||
    removeSource.isPending;

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    if (!organizationId) {
      toast.error("Organization is required.");
      return;
    }

    const collectionsById = new Map((collections ?? []).map((c) => [c.readableId, c]));
    const sqlConnectionsById = new Map(
      (sqlConnections ?? []).map((c) => [c.id, c]),
    );
    const vectorDbsById = new Map((vectorDbsData ?? []).map((db) => [db.id, db]));

    if (isEdit && project) {
      try {
        const nameChanged = name.trim() !== project.name;
        const descChanged = (description.trim() || null) !== (project.description ?? null);
        if (nameChanged || descChanged) {
          await updateProject.mutateAsync({
            id: project.id,
            input: {
              ...(nameChanged ? { name: name.trim() } : {}),
              ...(descChanged ? { description: description.trim() || null } : {}),
            },
            organizationId,
          });
        }

        const existing = getAirweaveCollectionIds(project.sources);
        const existingSet = new Set(existing);
        const selectedSet = new Set(selectedAirweaveCollectionIds);
        const toAdd = selectedAirweaveCollectionIds.filter((id) => !existingSet.has(id));
        const toRemove = existing.filter((id) => !selectedSet.has(id));

        for (const readableId of toAdd) {
          const match = collectionsById.get(readableId);
          const input: CreateDataSourceInput = {
            kind: "airweave_collection",
            name: match?.name ?? readableId,
            config: {
              airweaveCollectionReadableId: readableId,
              airweaveCollectionName: match?.name ?? readableId,
            },
          };
          await addSource.mutateAsync({ projectId: project.id, input, organizationId });
        }

        for (const readableId of toRemove) {
          const sourceId = getAirweaveSourceIdByReadableId(project.sources, readableId);
          if (!sourceId) continue;
          await removeSource.mutateAsync({
            projectId: project.id,
            sourceId,
            organizationId,
          });
        }

        const existingConns = getDatabaseConnectionIds(project.sources);
        const existingConnsSet = new Set(existingConns);
        const selectedConnsSet = new Set(selectedConnectionIds);
        const connsToAdd = selectedConnectionIds.filter(
          (id) => !existingConnsSet.has(id),
        );
        const connsToRemove = existingConns.filter(
          (id) => !selectedConnsSet.has(id),
        );

        for (const connectionId of connsToAdd) {
          const match = sqlConnectionsById.get(connectionId);
          if (!match) continue;
          const input: CreateDataSourceInput = {
            kind: "database",
            name: match.name,
            config: { connectionId, connectionName: match.name },
          };
          await addSource.mutateAsync({ projectId: project.id, input, organizationId });
        }

        for (const connectionId of connsToRemove) {
          const sourceId = getDatabaseSourceIdByConnectionId(
            project.sources,
            connectionId,
          );
          if (!sourceId) continue;
          await removeSource.mutateAsync({
            projectId: project.id,
            sourceId,
            organizationId,
          });
        }

        const existingVectorDbs = getVectorDbIds(project.sources);
        const existingVectorDbsSet = new Set(existingVectorDbs);
        const selectedVectorDbsSet = new Set(selectedVectorDbIds);
        const vectorDbsToAdd = selectedVectorDbIds.filter(
          (id) => !existingVectorDbsSet.has(id),
        );
        const vectorDbsToRemove = existingVectorDbs.filter(
          (id) => !selectedVectorDbsSet.has(id),
        );

        for (const vectorDbId of vectorDbsToAdd) {
          const match = vectorDbsById.get(vectorDbId);
          if (!match) continue;
          const input: CreateDataSourceInput = {
            kind: "vector_db",
            name: match.name,
            config: { vectorDbId, vectorDbName: match.name },
          };
          await addSource.mutateAsync({ projectId: project.id, input, organizationId });
        }

        for (const vectorDbId of vectorDbsToRemove) {
          const sourceId = getVectorDbSourceIdByVectorDbId(
            project.sources,
            vectorDbId,
          );
          if (!sourceId) continue;
          await removeSource.mutateAsync({
            projectId: project.id,
            sourceId,
            organizationId,
          });
        }

        toast.success("Project updated.");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update project.");
      }
      return;
    }

    try {
      const initialSources: CreateDataSourceInput[] = [
        ...selectedAirweaveCollectionIds.map((readableId): CreateDataSourceInput => {
          const match = collectionsById.get(readableId);
          return {
            kind: "airweave_collection",
            name: match?.name ?? readableId,
            config: {
              airweaveCollectionReadableId: readableId,
              airweaveCollectionName: match?.name ?? readableId,
            },
          };
        }),
        ...selectedConnectionIds
          .map((connectionId): CreateDataSourceInput | null => {
            const match = sqlConnectionsById.get(connectionId);
            if (!match) return null;
            return {
              kind: "database",
              name: match.name,
              config: { connectionId, connectionName: match.name },
            };
          })
          .filter((v): v is CreateDataSourceInput => v !== null),
        ...selectedVectorDbIds
          .map((vectorDbId): CreateDataSourceInput | null => {
            const match = vectorDbsById.get(vectorDbId);
            if (!match) return null;
            return {
              kind: "vector_db",
              name: match.name,
              config: { vectorDbId, vectorDbName: match.name },
            };
          })
          .filter((v): v is CreateDataSourceInput => v !== null),
      ];
      await createProject.mutateAsync({
        organizationId,
        name: name.trim(),
        description: description.trim() || null,
        initialSources: initialSources.length > 0 ? initialSources : undefined,
      });
      toast.success("Project created.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="project-form-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update project details and attached data sources."
              : "Projects group conversations and their data sources."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Research, Onboarding, …"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <OrgTargetField
            value={organizationId}
            onChange={(id) => {
              setOrganizationId(id);
              setSelectedAirweaveCollectionIds([]);
              setSelectedConnectionIds([]);
              setSelectedVectorDbIds([]);
            }}
            disabled={isEdit}
            organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
            showReadOnlyFallback={isEdit}
            readOnlyOrganizationName={
              organizations.find((o) => o.id === organizationId)?.name ??
              organizationId ??
              undefined
            }
            helpText={
              isEdit
                ? "Organization cannot be changed after creation."
                : undefined
            }
            testId="project-organization"
          />

          <div className="space-y-2">
            <Label>Airweave Collections</Label>
            <MultiSelectCombobox
              options={collectionOptions}
              value={selectedAirweaveCollectionIds}
              onChange={setSelectedAirweaveCollectionIds}
              placeholder={
                collectionsLoading ? "Loading Airweave Collections…" : "Select Airweave Collections"
              }
              emptyMessage="No Airweave Collections available for this organization."
              disabled={collectionsLoading}
              data-testid="project-collections-select"
            />
            <p className="text-xs text-muted-foreground">
              Airweave collections grounding the agent&apos;s answers.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Databases</Label>
            <MultiSelectCombobox
              options={sqlConnectionOptions}
              value={selectedConnectionIds}
              onChange={setSelectedConnectionIds}
              placeholder={
                sqlConnectionsLoading
                  ? "Loading SQL connections…"
                  : "Select databases"
              }
              emptyMessage="No SQL connections available. Add one in the organization dialog."
              disabled={!organizationId || sqlConnectionsLoading}
              data-testid="project-databases-select"
            />
            <p className="text-xs text-muted-foreground">
              Databases the chat agent can query read-only. Only connections with status
              &quot;ready&quot; appear here.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Vector databases</Label>
            <MultiSelectCombobox
              options={vectorDbOptions}
              value={selectedVectorDbIds}
              onChange={setSelectedVectorDbIds}
              placeholder={
                vectorDbsLoading
                  ? "Loading vector databases…"
                  : "Select vector databases"
              }
              emptyMessage="No vector databases available. Create one in the Vector databases section."
              disabled={vectorDbsLoading}
              data-testid="project-vector-dbs-select"
            />
            <p className="text-xs text-muted-foreground">
              Uploaded-document collections the chat agent retrieves from. A
              database becomes searchable once its status is &quot;ready&quot;.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            data-testid="project-form-submit"
          >
            {isSubmitting ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
