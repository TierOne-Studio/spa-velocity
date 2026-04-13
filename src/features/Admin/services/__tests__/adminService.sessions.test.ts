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

describe("adminService.listUserSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches sessions for a user", async () => {
    const sessions = [{ id: "s-1", token: "tok-1", userId: "user-1" }];
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sessions),
    });

    const result = await adminService.listUserSessions("user-1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1/sessions"),
    );
    expect(result).toEqual(sessions);
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Forbidden" }),
    });

    await expect(adminService.listUserSessions("user-1")).rejects.toThrow("Forbidden");
  });
});

describe("adminService.revokeSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST with sessionToken", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.revokeSession("token-abc");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/sessions/revoke"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionToken: "token-abc" }),
      }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Session not found" }),
    });

    await expect(adminService.revokeSession("bad-token")).rejects.toThrow("Session not found");
  });
});

describe("adminService.revokeAllSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends POST to revoke-all endpoint for user", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await adminService.revokeAllSessions("user-1");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users/user-1/sessions/revoke-all"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on error response", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Revoke failed" }),
    });

    await expect(adminService.revokeAllSessions("user-1")).rejects.toThrow("Revoke failed");
  });
});
