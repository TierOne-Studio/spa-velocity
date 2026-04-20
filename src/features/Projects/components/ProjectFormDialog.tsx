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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  MultiSelectCombobox,
  type MultiSelectOption,
} from "@/shared/components/ui/multi-select-combobox";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { getActiveOrganizationId } from "@/shared/utils/roles";
import { useOrganizations } from "@/features/Admin/hooks/useOrganizations";
import { useAirweaveCollections } from "@/features/Admin/hooks/useAirweaveCollections";

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

function readAllowedCollectionIds(metadata: unknown): string[] {
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
    .map((s) => s.config.collectionReadableId);
}

function getAirweaveSourceIdByReadableId(
  sources: ProjectDataSource[],
  readableId: string,
): string | null {
  const match = sources.find(
    (s) =>
      s.kind === "airweave_collection" &&
      s.config.collectionReadableId === readableId,
  );
  return match ? match.id : null;
}

export function ProjectFormDialog({ open, onOpenChange, project }: Props) {
  const isEdit = !!project;
  const { data: session } = useEffectiveSession();
  const activeOrgId = getActiveOrganizationId(session);

  const rawSessionRole = (session?.user as { role?: string | string[] } | undefined)?.role;
  const isSuperadmin = Array.isArray(rawSessionRole)
    ? rawSessionRole.includes("superadmin")
    : String(rawSessionRole ?? "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
        .includes("superadmin");

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
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setOrganizationId(project.organizationId);
      setSelectedCollectionIds(getAirweaveCollectionIds(project.sources));
    } else {
      setName("");
      setDescription("");
      setOrganizationId(activeOrgId);
      setSelectedCollectionIds([]);
    }
  }, [open, project, activeOrgId]);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const addSource = useAddProjectSource();
  const removeSource = useRemoveProjectSource();

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId),
    [organizations, organizationId],
  );

  const allowedCollectionIds = useMemo(() => {
    if (isSuperadmin) return null;
    if (selectedOrg) return readAllowedCollectionIds(selectedOrg.metadata);
    return null;
  }, [isSuperadmin, selectedOrg]);

  const collectionOptions = useMemo<MultiSelectOption[]>(() => {
    const list = collections ?? [];
    const allowed = allowedCollectionIds;
    const filtered = allowed ? list.filter((c) => allowed.includes(c.readableId)) : list;
    return filtered.map((c) => ({
      value: c.readableId,
      label: c.name,
      description: c.readableId,
    }));
  }, [collections, allowedCollectionIds]);

  const isSubmitting =
    createProject.isPending ||
    updateProject.isPending ||
    addSource.isPending ||
    removeSource.isPending;

  const orgDisabled = isEdit || !isSuperadmin;

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
        const selectedSet = new Set(selectedCollectionIds);
        const toAdd = selectedCollectionIds.filter((id) => !existingSet.has(id));
        const toRemove = existing.filter((id) => !selectedSet.has(id));

        for (const readableId of toAdd) {
          const match = collectionsById.get(readableId);
          const input: CreateDataSourceInput = {
            kind: "airweave_collection",
            name: match?.name ?? readableId,
            config: {
              collectionReadableId: readableId,
              collectionName: match?.name ?? readableId,
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

        toast.success("Project updated.");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update project.");
      }
      return;
    }

    try {
      const initialSources: CreateDataSourceInput[] = selectedCollectionIds.map(
        (readableId) => {
          const match = collectionsById.get(readableId);
          return {
            kind: "airweave_collection",
            name: match?.name ?? readableId,
            config: {
              collectionReadableId: readableId,
              collectionName: match?.name ?? readableId,
            },
          };
        },
      );
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

          <div className="space-y-2">
            <Label htmlFor="project-organization">Organization</Label>
            {isSuperadmin && !isEdit ? (
              <Select
                value={organizationId ?? undefined}
                onValueChange={(value) => {
                  setOrganizationId(value);
                  setSelectedCollectionIds([]);
                }}
              >
                <SelectTrigger id="project-organization">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="project-organization"
                value={
                  organizations.find((o) => o.id === organizationId)?.name ??
                  organizationId ??
                  ""
                }
                disabled
                readOnly
              />
            )}
            {orgDisabled && (
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? "Organization cannot be changed after creation."
                  : "Switch active organization in the sidebar to create a project elsewhere."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Collections</Label>
            <MultiSelectCombobox
              options={collectionOptions}
              value={selectedCollectionIds}
              onChange={setSelectedCollectionIds}
              placeholder={
                collectionsLoading ? "Loading collections…" : "Select collections"
              }
              emptyMessage="No collections available for this organization."
              disabled={collectionsLoading}
              data-testid="project-collections-select"
            />
            <p className="text-xs text-muted-foreground">
              Airweave collections grounding the agent&apos;s answers.
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
