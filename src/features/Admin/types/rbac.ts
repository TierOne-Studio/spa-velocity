/**
 * RBAC Types for Role-Based Access Control
 * 
 * These types mirror the backend database-driven RBAC system.
 */

/**
 * Permission entity from database
 */
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

/**
 * Role entity from database
 */
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Role with its associated permissions
 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/**
 * DTO for creating a new role
 */
export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  color?: string;
}

export interface CreateRoleRequest extends CreateRoleDto {
  organizationId?: string | null;
}

/**
 * DTO for updating a role
 */
export interface UpdateRoleDto {
  displayName?: string;
  description?: string;
  color?: string;
}

/**
 * DTO for assigning permissions to a role
 */
export interface AssignPermissionsDto {
  permissionIds: string[];
}

/**
 * Permissions grouped by resource
 */
export type PermissionsGrouped = Record<string, Permission[]>;

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Color options for roles
 */
export const ROLE_COLORS = [
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "purple", label: "Purple" },
  { value: "gray", label: "Gray" },
] as const;

/**
 * Color mapping for role badges
 */
export const roleColorMap: Record<string, string> = {
  red: "bg-red-500/10 text-red-500 border-red-500/20",
  gray: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  green: "bg-green-500/10 text-green-500 border-green-500/20",
  yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};
