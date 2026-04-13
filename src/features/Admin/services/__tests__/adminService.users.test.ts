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

vi.mock("@shared/lib/auth-client", () => ({
  admin: {},
  organization: {},
}));

import { adminService } from "../adminService";

describe("adminService.listUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches users with default params", async () => {
    const mockData = { data: [{ id: "1", name: "Alice" }], total: 1 };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await adminService.listUsers();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users"),
    );
    expect(result).toEqual(mockData);
  });

  it("appends searchValue to URL when provided", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    await adminService.listUsers({ searchValue: "alice" });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("searchValue=alice"),
    );
  });

  it("appends limit and offset to URL", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    await adminService.listUsers({ limit: 20, offset: 40 });

    const url = mockFetchWithAuth.mock.calls[0][0] as string;
    expect(url).toContain("limit=20");
    expect(url).toContain("offset=40");
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });

    await expect(adminService.listUsers()).rejects.toThrow("Unauthorized");
  });

  it("throws fallback message when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(adminService.listUsers()).rejects.toThrow("Failed to list users");
  });
});

describe("adminService.getUserCapabilities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches capabilities for a user", async () => {
    const caps = { targetUserId: "1", isSelf: false, actions: { update: true } };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(caps),
    });

    const result = await adminService.getUserCapabilities("1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/1/capabilities"),
    );
    expect(result).toEqual(caps);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Not found" }),
    });

    await expect(adminService.getUserCapabilities("999")).rejects.toThrow("Not found");
  });
});

describe("adminService.createUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST with correct body", async () => {
    const newUser = { id: "2", name: "Bob", email: "bob@example.com" };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newUser),
    });

    const result = await adminService.createUser({
      name: "Bob",
      email: "bob@example.com",
      password: "Pass123!",
      role: "member",
      organizationId: "org-1",
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "bob@example.com",
          password: "Pass123!",
          name: "Bob",
          role: "member",
          organizationId: "org-1",
        }),
      }),
    );
    expect(result).toEqual(newUser);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Email already exists" }),
    });

    await expect(
      adminService.createUser({ name: "X", email: "x@x.com", password: "P", role: "member" }),
    ).rejects.toThrow("Email already exists");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(
      adminService.createUser({ name: "X", email: "x@x.com", password: "P", role: "member" }),
    ).rejects.toThrow("Failed to create user");
  });
});

describe("adminService.updateUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends PUT with user id and name", async () => {
    const updated = { id: "1", name: "Updated Name" };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updated),
    });

    const result = await adminService.updateUser({ userId: "1", data: { name: "Updated Name" } });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/1"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ name: "Updated Name" }),
      }),
    );
    expect(result).toEqual(updated);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Update failed" }),
    });

    await expect(
      adminService.updateUser({ userId: "1", data: { name: "X" } }),
    ).rejects.toThrow("Update failed");
  });
});

describe("adminService.removeUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends DELETE request for user", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.removeUser("user-1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Cannot delete admin" }),
    });

    await expect(adminService.removeUser("admin-1")).rejects.toThrow("Cannot delete admin");
  });
});

describe("adminService.removeUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to bulk-delete with userIds", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, deletedCount: 2 }),
    });

    const result = await adminService.removeUsers(["user-1", "user-2"]);

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/bulk-delete"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userIds: ["user-1", "user-2"] }),
      }),
    );
    expect(result).toEqual({ success: true, deletedCount: 2 });
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Bulk delete failed" }),
    });

    await expect(adminService.removeUsers(["user-1"])).rejects.toThrow("Bulk delete failed");
  });
});

describe("adminService.banUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to ban endpoint with banReason", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.banUser({ userId: "user-1", banReason: "Violation" });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1/ban"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ banReason: "Violation" }),
      }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Cannot ban admin" }),
    });

    await expect(adminService.banUser({ userId: "admin-1", banReason: "Test" })).rejects.toThrow("Cannot ban admin");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(adminService.banUser({ userId: "u-1", banReason: "x" })).rejects.toThrow("Failed to ban user");
  });
});

describe("adminService.unbanUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to unban endpoint", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.unbanUser("user-1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1/unban"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Unban failed" }),
    });

    await expect(adminService.unbanUser("user-1")).rejects.toThrow("Unban failed");
  });
});

describe("adminService.setRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends PUT to role endpoint with string role", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.setRole({ userId: "user-1", role: "manager" });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1/role"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ role: "manager" }),
      }),
    );
  });

  it("uses first element when role is an array", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.setRole({ userId: "user-1", role: ["admin", "manager"] as any });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({ role: "admin" }),
      }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Role change forbidden" }),
    });

    await expect(adminService.setRole({ userId: "user-1", role: "admin" })).rejects.toThrow("Role change forbidden");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(adminService.setRole({ userId: "u-1", role: "member" })).rejects.toThrow("Failed to set user role");
  });
});

describe("adminService.setPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to password endpoint", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.setPassword({ userId: "user-1", newPassword: "NewPass123!" });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1/password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ newPassword: "NewPass123!" }),
      }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Password too weak" }),
    });

    await expect(adminService.setPassword({ userId: "user-1", newPassword: "weak" })).rejects.toThrow("Password too weak");
  });
});

describe("adminService.getCreateUserMetadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches create user metadata", async () => {
    const metadata = {
      roles: [{ name: "member", displayName: "Member", isSystem: true }],
      allowedRoleNames: ["admin", "manager", "member"],
      organizations: [{ id: "org-1", name: "Org 1", slug: "org-1" }],
    };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(metadata),
    });

    const result = await adminService.getCreateUserMetadata();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/create-metadata"),
    );
    expect(result).toEqual(metadata);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Forbidden" }),
    });

    await expect(adminService.getCreateUserMetadata()).rejects.toThrow("Forbidden");
  });
});
