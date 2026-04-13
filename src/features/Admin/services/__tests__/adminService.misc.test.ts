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

import { getOrganizationRolesMetadata } from "../adminService";

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

