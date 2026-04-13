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

describe("adminService.getBatchCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object immediately when userIds is empty", async () => {
    const result = await adminService.getBatchCapabilities([]);

    expect(result).toEqual({});
    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it("POSTs to capabilities/batch with the provided userIds", async () => {
    const mockData = {
      "user-1": {
        targetUserId: "user-1",
        targetRole: "member",
        isSelf: false,
        actions: { update: true, setRole: true, ban: true, unban: true, setPassword: true, remove: true, revokeSessions: true, impersonate: true },
      },
    };

    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await adminService.getBatchCapabilities(["user-1"]);

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/capabilities/batch"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ["user-1"] }),
      }),
    );
    expect(result).toEqual(mockData);
  });

  it("throws error message from API on non-ok response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Forbidden" }),
    });

    await expect(adminService.getBatchCapabilities(["user-1"])).rejects.toThrow("Forbidden");
  });

  it("throws fallback message when json parse fails — covers .catch(() => ({})) branch", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    });

    await expect(adminService.getBatchCapabilities(["user-1"])).rejects.toThrow(
      "Failed to fetch batch capabilities",
    );
  });
});
