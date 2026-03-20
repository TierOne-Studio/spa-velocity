import type {
  Role,
  RoleWithPermissions,
  Permission,
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  PermissionsGrouped,
  ApiResponse,
} from "../types/rbac";
import { fetchWithAuth } from "@shared/lib/fetch-with-auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * RBAC Service for managing roles and permissions via API
 */
export const rbacService = {
  // ============ Roles ============

  /**
   * Get all roles
   */
  async getRoles(organizationId?: string | null): Promise<Role[]> {
    const url = new URL(`${API_BASE_URL}/api/rbac/roles`);
    if (organizationId) {
      url.searchParams.set("organizationId", organizationId);
    }

    const response = await fetchWithAuth(url.toString());
    if (!response.ok) {
      throw new Error("Failed to fetch roles");
    }
    const result: ApiResponse<Role[]> = await response.json();
    return result.data;
  },

  /**
   * Get role by ID with permissions
   */
  async getRole(id: string): Promise<RoleWithPermissions> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/roles/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch role");
    }
    const result: ApiResponse<RoleWithPermissions> = await response.json();
    return result.data;
  },

  /**
   * Create a new role
   */
  async createRole(dto: CreateRoleDto, organizationId?: string | null): Promise<Role> {
    const url = new URL(`${API_BASE_URL}/api/rbac/roles`);
    if (organizationId) {
      url.searchParams.set("organizationId", organizationId);
    }

    const response = await fetchWithAuth(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to create role");
    }
    const result: ApiResponse<Role> = await response.json();
    return result.data;
  },

  /**
   * Update a role
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/roles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      throw new Error("Failed to update role");
    }
    const result: ApiResponse<Role> = await response.json();
    return result.data;
  },

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/roles/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete role");
    }
  },

  /**
   * Assign permissions to a role
   */
  async assignPermissions(roleId: string, dto: AssignPermissionsDto): Promise<RoleWithPermissions> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/roles/${roleId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      throw new Error("Failed to assign permissions");
    }
    const result: ApiResponse<RoleWithPermissions> = await response.json();
    return result.data;
  },

  // ============ Permissions ============

  /**
   * Get all permissions
   */
  async getPermissions(): Promise<Permission[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/permissions`);
    if (!response.ok) {
      throw new Error("Failed to fetch permissions");
    }
    const result: ApiResponse<Permission[]> = await response.json();
    return result.data;
  },

  /**
   * Get permissions grouped by resource
   */
  async getPermissionsGrouped(): Promise<PermissionsGrouped> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/permissions/grouped`);
    if (!response.ok) {
      throw new Error("Failed to fetch permissions");
    }
    const result: ApiResponse<PermissionsGrouped> = await response.json();
    return result.data;
  },

  // ============ Permission Checking ============

  /**
   * Get user's effective permissions based on role
   */
  async getUserPermissions(roleName: string): Promise<Permission[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/users/${roleName}/permissions`);
    if (!response.ok) {
      throw new Error("Failed to fetch user permissions");
    }
    const result: ApiResponse<Permission[]> = await response.json();
    return result.data;
  },

  /**
   * Check if a role has a specific permission
   */
  async checkPermission(roleName: string, resource: string, action: string): Promise<boolean> {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/api/rbac/check/${roleName}/${resource}/${action}`
    );
    if (!response.ok) {
      return false;
    }
    const result: ApiResponse<{ hasPermission: boolean }> = await response.json();
    return result.data.hasPermission;
  },
  /**
   * Get the current authenticated user's effective permissions.
   * Returns an array of permission strings like ["organization:create", "user:read"].
   */
  async getMyPermissions(): Promise<string[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/rbac/my-permissions`);
    if (!response.ok) {
      return [];
    }
    const result: ApiResponse<unknown> | null = await response.json().catch(() => null);
    if (!result || !Array.isArray(result.data)) {
      return [];
    }

    return result.data.filter((permission): permission is string => typeof permission === "string");
  },
};
