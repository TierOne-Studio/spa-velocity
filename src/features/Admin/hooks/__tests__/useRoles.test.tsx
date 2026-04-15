import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useRoles,
  useRole,
  useUsersByRole,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useAssignPermissions,
  usePermissions,
  usePermissionsGrouped,
  rbacKeys,
} from "../useRoles";
import { rbacService } from "../../services/rbacService";
import { adminService } from "../../services/adminService";

// Mock the services
vi.mock("../../services/rbacService", () => ({
  rbacService: {
    getRoles: vi.fn(),
    getRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    assignPermissions: vi.fn(),
    getPermissions: vi.fn(),
    getPermissionsGrouped: vi.fn(),
    getUserPermissions: vi.fn(),
    checkPermission: vi.fn(),
  },
}));

vi.mock("../../services/adminService", () => ({
  adminService: {
    listUsers: vi.fn(),
  },
}));

// Get typed mock references
const mockRbacService = rbacService as unknown as {
  getRoles: Mock;
  getRole: Mock;
  createRole: Mock;
  deleteRole: Mock;
};

const mockAdminService = adminService as unknown as {
  listUsers: Mock;
};

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRoles hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rbacKeys", () => {
    it("should generate correct query keys", () => {
      expect(rbacKeys.all).toEqual(["rbac"]);
      expect(rbacKeys.roles()).toEqual(["rbac", "roles", "no-org"]);
      expect(rbacKeys.roles("org-1")).toEqual(["rbac", "roles", "org-1"]);
      expect(rbacKeys.role("role-1")).toEqual(["rbac", "role", "role-1"]);
      expect(rbacKeys.permissions()).toEqual(["rbac", "permissions"]);
      expect(rbacKeys.usersByRole("admin")).toEqual(["rbac", "users", "admin"]);
    });
  });

  describe("useRoles", () => {
    it("should fetch roles from API", async () => {
      const mockRoles = [
        { id: "1", name: "admin", displayName: "Admin", description: "Full access", color: "red", isSystem: true },
        { id: "2", name: "member", displayName: "Member", description: "Basic member", color: "gray", isSystem: true },
      ];
      mockRbacService.getRoles.mockResolvedValue(mockRoles);

      const { result } = renderHook(() => useRoles(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("admin");
    });
  });

  describe("useUsersByRole", () => {
    it("should fetch users filtered by role", async () => {
      const mockUsers = {
        data: [
          { id: "1", name: "Admin User", email: "admin@example.com", role: "admin" },
        ],
        total: 1,
      };
      mockAdminService.listUsers.mockResolvedValue(mockUsers);

      const { result } = renderHook(() => useUsersByRole("admin"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUsers);
      expect(mockAdminService.listUsers).toHaveBeenCalledWith({
        filterField: "role",
        filterValue: "admin",
      });
    });
  });

  describe("useCreateRole", () => {
    it("should create a new role", async () => {
      const newRole = { id: "3", name: "editor", displayName: "Editor", color: "blue", isSystem: false };
      mockRbacService.createRole.mockResolvedValue(newRole);

      const { result } = renderHook(() => useCreateRole(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        name: "editor",
        displayName: "Editor",
        color: "blue",
      });

      expect(mockRbacService.createRole).toHaveBeenCalledWith({
        name: "editor",
        displayName: "Editor",
        color: "blue",
      });
    });

    it("should create a role with organizationId scope", async () => {
      const newRole = { id: "4", name: "reviewer", displayName: "Reviewer", color: "green", isSystem: false };
      mockRbacService.createRole.mockResolvedValue(newRole);

      const { result } = renderHook(() => useCreateRole(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        name: "reviewer",
        displayName: "Reviewer",
        color: "green",
        organizationId: "org-1",
      });

      expect(mockRbacService.createRole).toHaveBeenCalledWith(
        { name: "reviewer", displayName: "Reviewer", color: "green" },
        "org-1",
      );
    });
  });

  describe("useDeleteRole", () => {
    it("should delete a role", async () => {
      mockRbacService.deleteRole.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteRole(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync("role-1");

      expect(mockRbacService.deleteRole).toHaveBeenCalledWith("role-1");
    });
  });

  describe("useRole", () => {
    it("should fetch a single role by id", async () => {
      const mockRole = { id: "1", name: "admin", displayName: "Admin", permissions: [] };
      (mockRbacService as any).getRole = vi.fn().mockResolvedValue(mockRole);

      const { result } = renderHook(() => useRole("1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockRole);
      expect((mockRbacService as any).getRole).toHaveBeenCalledWith("1");
    });

    it("should be disabled when id is empty", () => {
      const { result } = renderHook(() => useRole(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useUpdateRole", () => {
    it("should update a role", async () => {
      const updated = { id: "1", name: "admin", displayName: "Super Admin" };
      (mockRbacService as any).updateRole = vi.fn().mockResolvedValue(updated);

      const { result } = renderHook(() => useUpdateRole(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ id: "1", dto: { displayName: "Super Admin" } });

      expect((mockRbacService as any).updateRole).toHaveBeenCalledWith("1", { displayName: "Super Admin" });
    });
  });

  describe("useAssignPermissions", () => {
    it("should assign permissions to a role", async () => {
      const roleWithPerms = { id: "1", name: "manager", permissions: [{ id: "p1" }] };
      (mockRbacService as any).assignPermissions = vi.fn().mockResolvedValue(roleWithPerms);

      const { result } = renderHook(() => useAssignPermissions(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ roleId: "1", dto: { permissionIds: ["p1"] } });

      expect((mockRbacService as any).assignPermissions).toHaveBeenCalledWith("1", { permissionIds: ["p1"] });
    });
  });

  describe("usePermissions", () => {
    it("should fetch all permissions", async () => {
      const perms = [{ id: "p1", resource: "user", action: "read", description: null }];
      (mockRbacService as any).getPermissions = vi.fn().mockResolvedValue(perms);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(perms);
    });
  });

  describe("usePermissionsGrouped", () => {
    it("should fetch permissions grouped by resource", async () => {
      const grouped = { user: [{ id: "p1", resource: "user", action: "read", description: null }] };
      (mockRbacService as any).getPermissionsGrouped = vi.fn().mockResolvedValue(grouped);

      const { result } = renderHook(() => usePermissionsGrouped(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(grouped);
    });
  });

  describe("rbacKeys completeness", () => {
    it("should generate myPermissions key", () => {
      expect(rbacKeys.myPermissions()).toEqual(["rbac", "my-permissions"]);
    });

    it("should generate permissionsGrouped key", () => {
      expect(rbacKeys.permissionsGrouped()).toEqual(["rbac", "permissions", "grouped"]);
    });

    it("should generate userPermissions key", () => {
      expect(rbacKeys.userPermissions("admin")).toEqual(["rbac", "userPermissions", "admin"]);
    });
  });
});
