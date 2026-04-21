import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { getActiveOrganizationId } from "@/shared/utils/roles";

import { projectsService } from "../services/projectsService";
import type {
  CreateDataSourceInput,
  CreateProjectInput,
  UpdateProjectInput,
} from "../types";

type Scope = {
  organizationId?: string | null;
  userId?: string | null;
};

export const projectsKeys = {
  all: ["projects"] as const,
  list: (scope?: Scope & { scopeAll?: boolean }) =>
    [
      ...projectsKeys.all,
      "list",
      scope?.userId ?? "anonymous",
      scope?.scopeAll ? "scope-all" : scope?.organizationId ?? "no-org",
    ] as const,
  detail: (id: string, scope?: Scope) =>
    [
      ...projectsKeys.all,
      "detail",
      scope?.userId ?? "anonymous",
      scope?.organizationId ?? "no-org",
      id,
    ] as const,
};

function useScope(organizationId?: string | null): Scope {
  const { data: session } = useEffectiveSession();
  const active = getActiveOrganizationId(session);
  return {
    userId: session?.user?.id ?? null,
    organizationId: organizationId ?? active,
  };
}

export function useProjects(options?: {
  organizationId?: string | null;
  scope?: "all";
  enabled?: boolean;
}) {
  const scope = useScope(options?.organizationId);
  const scopeAll = options?.scope === "all";
  return useQuery({
    queryKey: projectsKeys.list({ ...scope, scopeAll }),
    queryFn: () =>
      projectsService.list(
        scopeAll ? null : options?.organizationId,
        scopeAll ? { scope: "all" } : undefined,
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useProject(
  id: string | null | undefined,
  options?: { organizationId?: string | null; enabled?: boolean },
) {
  const scope = useScope(options?.organizationId);
  return useQuery({
    queryKey: projectsKeys.detail(id ?? "", scope),
    queryFn: () => projectsService.getById(id as string, options?.organizationId),
    enabled: (options?.enabled ?? true) && !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      organizationId,
    }: {
      id: string;
      input: UpdateProjectInput;
      organizationId?: string | null;
    }) => projectsService.update(id, input, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      organizationId,
    }: {
      id: string;
      organizationId?: string | null;
    }) => projectsService.remove(id, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useAddProjectSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
      organizationId,
    }: {
      projectId: string;
      input: CreateDataSourceInput;
      organizationId?: string | null;
    }) => projectsService.addSource(projectId, input, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useRemoveProjectSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      sourceId,
      organizationId,
    }: {
      projectId: string;
      sourceId: string;
      organizationId?: string | null;
    }) => projectsService.removeSource(projectId, sourceId, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}
