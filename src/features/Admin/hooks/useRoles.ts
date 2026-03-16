import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rbacService } from "../services/rbacService";
import { adminService } from "../services/adminService";
import type {
  Role,
  RoleWithPermissions,
  Permission,
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  PermissionsGrouped,
} from "../types/rbac";

/**
 * Query keys for RBAC-related queries
 */
export const rbacKeys = {
  all: ["rbac"] as const,
  myPermissions: () => [...rbacKeys.all, "my-permissions"] as const,
  roles: (activeOrganizationId?: string | null) =>
    [...rbacKeys.all, "roles", activeOrganizationId ?? "no-org"] as const,
  role: (id: string) => [...rbacKeys.all, "role", id] as const,
  permissions: () => [...rbacKeys.all, "permissions"] as const,
  permissionsGrouped: () => [...rbacKeys.all, "permissions", "grouped"] as const,
  userPermissions: (roleName: string) => [...rbacKeys.all, "userPermissions", roleName] as const,
  usersByRole: (role: string) => [...rbacKeys.all, "users", role] as const,
};

// ============ Roles Hooks ============

/**
 * Hook to fetch all roles
 */
export function useRoles(options?: { activeOrganizationId?: string | null; enabled?: boolean }) {
  return useQuery({
    queryKey: rbacKeys.roles(options?.activeOrganizationId),
    queryFn: () => rbacService.getRoles(),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to fetch a single role with permissions
 */
export function useRole(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rbacKeys.role(id),
    queryFn: () => rbacService.getRole(id),
    enabled: options?.enabled ?? !!id,
  });
}

/**
 * Hook to create a new role
 */
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateRoleDto) => rbacService.createRole(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
      queryClient.invalidateQueries({ queryKey: rbacKeys.myPermissions() });
    },
  });
}

/**
 * Hook to update a role
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRoleDto }) =>
      rbacService.updateRole(id, dto),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
      queryClient.invalidateQueries({ queryKey: rbacKeys.role(id) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.myPermissions() });
    },
  });
}

/**
 * Hook to delete a role
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rbacService.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
      queryClient.invalidateQueries({ queryKey: rbacKeys.myPermissions() });
    },
  });
}

/**
 * Hook to assign permissions to a role
 */
export function useAssignPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, dto }: { roleId: string; dto: AssignPermissionsDto }) =>
      rbacService.assignPermissions(roleId, dto),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
      queryClient.invalidateQueries({ queryKey: rbacKeys.role(roleId) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.myPermissions() });
    },
  });
}

// ============ Permissions Hooks ============

/**
 * Hook to fetch all permissions
 */
export function usePermissions() {
  return useQuery({
    queryKey: rbacKeys.permissions(),
    queryFn: () => rbacService.getPermissions(),
  });
}

/**
 * Hook to fetch permissions grouped by resource
 */
export function usePermissionsGrouped(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rbacKeys.permissionsGrouped(),
    queryFn: () => rbacService.getPermissionsGrouped(),
    enabled: options?.enabled ?? true,
  });
}

// ============ User Permission Hooks ============

/**
 * Hook to fetch users filtered by role
 */
export function useUsersByRole(roleName: string) {
  return useQuery({
    queryKey: rbacKeys.usersByRole(roleName),
    queryFn: () =>
      adminService.listUsers({
        filterField: "role",
        filterValue: roleName,
      }),
    enabled: !!roleName,
  });
}

/**
 * Hook to get user's effective permissions
 */
export function useUserPermissions(roleName: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rbacKeys.userPermissions(roleName),
    queryFn: () => rbacService.getUserPermissions(roleName),
    enabled: options?.enabled ?? !!roleName,
  });
}

/**
 * Hook to check if current user has a specific permission
 */
export function useCheckPermission(
  roleName: string,
  resource: string,
  action: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...rbacKeys.all, "check", roleName, resource, action],
    queryFn: () => rbacService.checkPermission(roleName, resource, action),
    enabled: options?.enabled ?? !!roleName,
  });
}

// Re-export types for convenience
export type { Role, RoleWithPermissions, Permission, PermissionsGrouped };
