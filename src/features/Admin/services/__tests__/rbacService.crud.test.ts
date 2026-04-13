import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchWithAuth } = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(),
}));

vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: mockFetchWithAuth,
  fetchApi: async (url: string, options?: RequestInit, fallbackMessage = "Request failed") => {
    const response = await mockFetchWithAuth(...[url, options].filter(v => v !== undefined));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || fallbackMessage);
    }
    if (response.status === 204) return undefined;
    return response.json();
  },
}));

import { rbacService } from "../rbacService";

describe("rbacService.getRoles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches all roles", async () => {
    const roles = [{ id: "1", name: "admin", displayName: "Admin", isSystem: true }];
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: roles }),
    });

    const result = await rbacService.getRoles();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/roles"),
    );
    expect(result).toEqual(roles);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.getRoles()).rejects.toThrow("Failed to fetch roles");
  });
});

describe("rbacService.getRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches a single role by id", async () => {
    const role = { id: "1", name: "admin", permissions: [] };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: role }),
    });

    const result = await rbacService.getRole("1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/roles/1"),
    );
    expect(result).toEqual(role);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.getRole("999")).rejects.toThrow("Failed to fetch role");
  });
});

describe("rbacService.createRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST with role dto", async () => {
    const newRole = { id: "3", name: "editor", displayName: "Editor", isSystem: false };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: newRole }),
    });

    const result = await rbacService.createRole({ name: "editor", displayName: "Editor", color: "green" });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/roles"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "editor", displayName: "Editor", color: "green" }),
      }),
    );
    expect(result).toEqual(newRole);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Role already exists" }),
    });

    await expect(rbacService.createRole({ name: "admin", displayName: "Admin" })).rejects.toThrow("Role already exists");
  });

  it("throws fallback message when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(rbacService.createRole({ name: "x", displayName: "X" })).rejects.toThrow(
      "Failed to create role",
    );
  });
});

describe("rbacService.updateRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends PUT with updated role dto", async () => {
    const updated = { id: "1", name: "admin", displayName: "Super Admin", isSystem: true };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: updated }),
    });

    const result = await rbacService.updateRole("1", { displayName: "Super Admin" });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/roles/1"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ displayName: "Super Admin" }),
      }),
    );
    expect(result).toEqual(updated);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.updateRole("1", { displayName: "X" })).rejects.toThrow("Failed to update role");
  });
});

describe("rbacService.deleteRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends DELETE request for role", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await rbacService.deleteRole("role-1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/roles/role-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Cannot delete system role" }),
    });

    await expect(rbacService.deleteRole("admin")).rejects.toThrow("Cannot delete system role");
  });

  it("throws fallback message when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(rbacService.deleteRole("role-1")).rejects.toThrow("Failed to delete role");
  });
});

describe("rbacService.assignPermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends PUT with permissions dto", async () => {
    const roleWithPerms = { id: "1", name: "manager", permissions: ["user:read"] };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: roleWithPerms }),
    });

    const result = await rbacService.assignPermissions("1", { permissionIds: ["perm-1"] });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/roles/1/permissions"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ permissionIds: ["perm-1"] }),
      }),
    );
    expect(result).toEqual(roleWithPerms);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.assignPermissions("1", { permissionIds: [] })).rejects.toThrow("Failed to assign permissions");
  });
});

describe("rbacService.getPermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches all permissions", async () => {
    const permissions = [{ id: "1", name: "user:read", resource: "user", action: "read" }];
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: permissions }),
    });

    const result = await rbacService.getPermissions();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/permissions"),
    );
    expect(result).toEqual(permissions);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.getPermissions()).rejects.toThrow("Failed to fetch permissions");
  });
});

describe("rbacService.getPermissionsGrouped", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches permissions grouped by resource", async () => {
    const grouped = { user: ["read", "create"], organization: ["create"] };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: grouped }),
    });

    const result = await rbacService.getPermissionsGrouped();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/permissions/grouped"),
    );
    expect(result).toEqual(grouped);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.getPermissionsGrouped()).rejects.toThrow("Failed to fetch permissions");
  });
});

describe("rbacService.getUserPermissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches permissions for a role name", async () => {
    const permissions = [{ id: "1", name: "user:read", resource: "user", action: "read" }];
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: permissions }),
    });

    const result = await rbacService.getUserPermissions("manager");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/users/manager/permissions"),
    );
    expect(result).toEqual(permissions);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    await expect(rbacService.getUserPermissions("member")).rejects.toThrow("Failed to fetch user permissions");
  });
});

describe("rbacService.checkPermission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when permission is granted", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { hasPermission: true } }),
    });

    const result = await rbacService.checkPermission("manager", "user", "read");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/rbac/check/manager/user/read"),
    );
    expect(result).toBe(true);
  });

  it("returns false when permission is denied", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { hasPermission: false } }),
    });

    const result = await rbacService.checkPermission("member", "user", "create");

    expect(result).toBe(false);
  });

  it("returns false on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    const result = await rbacService.checkPermission("member", "user", "delete");

    expect(result).toBe(false);
  });
});
