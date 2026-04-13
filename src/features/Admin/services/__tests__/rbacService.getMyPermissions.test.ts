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

describe("rbacService.getMyPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when API response is not ok", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: false });

    const result = await rbacService.getMyPermissions();

    expect(result).toEqual([]);
  });

  it("returns [] when data is missing or not an array", async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });

    await expect(rbacService.getMyPermissions()).resolves.toEqual([]);

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { permission: "user:read" } }),
    });

    await expect(rbacService.getMyPermissions()).resolves.toEqual([]);
  });

  it("returns only string permissions when payload contains mixed values", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: ["user:read", 1, null, "organization:create"] }),
    });

    const result = await rbacService.getMyPermissions();

    expect(result).toEqual(["user:read", "organization:create"]);
  });
});
