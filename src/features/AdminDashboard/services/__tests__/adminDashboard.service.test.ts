import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchWithAuth } = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(),
}));

vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: mockFetchWithAuth,
  fetchApi: async (url: string, options?: RequestInit, fallbackMessage = "Request failed") => {
    const response = await mockFetchWithAuth(...[url, options].filter((v) => v !== undefined));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as { message?: string }).message || fallbackMessage);
    }
    if (response.status === 204) return undefined;
    return response.json();
  },
}));

import { adminDashboardService } from "../adminDashboard.service";

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const fail = (message: string) => ({
  ok: false,
  status: 400,
  json: () => Promise.resolve({ message }),
});

describe("adminDashboardService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getAvailableOrganizations", () => {
    it("returns org list on success", async () => {
      const orgs = [{ id: "1", name: "Org One", slug: "org-one" }];
      mockFetchWithAuth.mockResolvedValue(ok(orgs));

      const result = await adminDashboardService.getAvailableOrganizations();
      expect(result).toEqual(orgs);
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/dashboard/organizations/list"),
      );
    });

    it("throws on error", async () => {
      mockFetchWithAuth.mockResolvedValue(fail("Unauthorized"));
      await expect(adminDashboardService.getAvailableOrganizations()).rejects.toThrow("Unauthorized");
    });
  });

  describe("getOverview", () => {
    it("calls correct URL without org filter", async () => {
      const overview = { totalUsers: 5 };
      mockFetchWithAuth.mockResolvedValue(ok(overview));

      const result = await adminDashboardService.getOverview();
      expect(result).toEqual(overview);
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/dashboard/overview"),
      );
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).not.toContain("organizationId");
    });

    it("appends organizationId query param when provided", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({}));

      await adminDashboardService.getOverview("org-123");
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("organizationId=org-123");
    });

    it("throws on error response", async () => {
      mockFetchWithAuth.mockResolvedValue(fail("Failed to load overview stats"));
      await expect(adminDashboardService.getOverview()).rejects.toThrow("Failed to load overview stats");
    });
  });

  describe("getUserStats", () => {
    it("calls correct URL with range and no orgId", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({ total: 10 }));

      await adminDashboardService.getUserStats("30d");
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("/api/admin/dashboard/users?range=30d");
      expect(url).not.toContain("organizationId");
    });

    it("appends organizationId when provided", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({}));

      await adminDashboardService.getUserStats("7d", "org-abc");
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("range=7d");
      expect(url).toContain("organizationId=org-abc");
    });

    it("throws on error", async () => {
      mockFetchWithAuth.mockResolvedValue(fail("Bad request"));
      await expect(adminDashboardService.getUserStats("90d")).rejects.toThrow("Bad request");
    });
  });

  describe("getChatStats", () => {
    it("calls correct URL with range", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({ totalConversations: 3 }));

      await adminDashboardService.getChatStats("90d");
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("/api/admin/dashboard/chat?range=90d");
    });

    it("appends organizationId when provided", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({}));

      await adminDashboardService.getChatStats("7d", "org-xyz");
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("organizationId=org-xyz");
    });
  });

  describe("getOrgStats", () => {
    it("calls correct URL without orgId", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({ totalOrganizations: 2 }));

      await adminDashboardService.getOrgStats();
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("/api/admin/dashboard/organizations");
      expect(url).not.toContain("organizationId");
    });

    it("appends organizationId when provided", async () => {
      mockFetchWithAuth.mockResolvedValue(ok({}));

      await adminDashboardService.getOrgStats("org-1");
      const url: string = mockFetchWithAuth.mock.calls[0][0];
      expect(url).toContain("organizationId=org-1");
    });
  });
});
