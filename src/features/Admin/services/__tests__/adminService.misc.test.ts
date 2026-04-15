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

import { getOrganizationRolesMetadata, adminService } from "../adminService";

describe("getOrganizationRolesMetadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns roles metadata on success", async () => {
    const metadata = { roles: [], assignableRoles: [] };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(metadata),
    });

    const result = await getOrganizationRolesMetadata();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/platform-admin/organizations/roles-metadata"),
    );
    expect(result).toEqual(metadata);
  });

  it("throws on error response with message", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Forbidden" }),
    });

    await expect(getOrganizationRolesMetadata()).rejects.toThrow("Forbidden");
  });

  it("throws fallback message when error has no message — covers || fallback branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(getOrganizationRolesMetadata()).rejects.toThrow("Failed to get organization roles metadata");
  });

  it("throws fallback when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(getOrganizationRolesMetadata()).rejects.toThrow("Failed to get organization roles metadata");
  });
});

describe("getOrganizationRolesMetadata with organizationId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appends organizationId to URL when provided", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ roles: [], assignableRoles: [] }),
    });

    await getOrganizationRolesMetadata("org-42");
    const url: string = mockFetchWithAuth.mock.calls[0][0];
    expect(url).toContain("organizationId=org-42");
  });
});

describe("adminService.selfApproveInvited", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to self-approve-invited endpoint", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await adminService.selfApproveInvited();

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/self-approve-invited"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Not invited" }),
    });

    await expect(adminService.selfApproveInvited()).rejects.toThrow("Not invited");
  });
});

describe("adminService.listPendingUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches pending users with defaults", async () => {
    const data = { data: [], total: 0 };
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await adminService.listPendingUsers();
    const url: string = mockFetchWithAuth.mock.calls[0][0];
    expect(url).toContain("/api/admin/users/pending");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=0");
    expect(result).toEqual(data);
  });

  it("appends searchValue when provided", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 0 }) });

    await adminService.listPendingUsers({ searchValue: "alice" });
    const url: string = mockFetchWithAuth.mock.calls[0][0];
    expect(url).toContain("searchValue=alice");
  });

  it("does not append searchValue when not provided", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 0 }) });

    await adminService.listPendingUsers();
    const url: string = mockFetchWithAuth.mock.calls[0][0];
    expect(url).not.toContain("searchValue");
  });
});

describe("adminService.approveUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to approve endpoint", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await adminService.approveUser("user-5");
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-5/approve"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: "Forbidden" }) });
    await expect(adminService.approveUser("user-5")).rejects.toThrow("Forbidden");
  });
});

describe("adminService.rejectUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to reject endpoint with rejection reason", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await adminService.rejectUser("user-6", "Not eligible");
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-6/reject"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Not eligible"),
      }),
    );
  });

  it("sends POST without reason", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

    await adminService.rejectUser("user-7");
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-7/reject"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("adminService.listUsers with organizationId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appends organizationId when provided", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 0 }) });

    await adminService.listUsers({ organizationId: "org-99" });
    const url: string = mockFetchWithAuth.mock.calls[0][0];
    expect(url).toContain("organizationId=org-99");
  });
});

