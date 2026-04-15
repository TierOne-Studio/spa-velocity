import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

const mockGetAvailableOrganizations = vi.fn();
const mockGetOverview = vi.fn();
const mockGetUserStats = vi.fn();
const mockGetChatStats = vi.fn();
const mockGetOrgStats = vi.fn();

vi.mock("../../services/adminDashboard.service", () => ({
  adminDashboardService: {
    getAvailableOrganizations: (...args: unknown[]) => mockGetAvailableOrganizations(...args),
    getOverview: (...args: unknown[]) => mockGetOverview(...args),
    getUserStats: (...args: unknown[]) => mockGetUserStats(...args),
    getChatStats: (...args: unknown[]) => mockGetChatStats(...args),
    getOrgStats: (...args: unknown[]) => mockGetOrgStats(...args),
  },
}));

import {
  useOverviewStats,
  useUserStats,
  useChatStats,
  useOrgStats,
  useAvailableOrgs,
  dashboardKeys,
} from "../useAdminDashboard";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("dashboardKeys", () => {
  it("generates stable overview key", () => {
    expect(dashboardKeys.overview("org-1")).toEqual(["admin-dashboard", "overview", "org-1"]);
    expect(dashboardKeys.overview(null)).toEqual(["admin-dashboard", "overview", null]);
  });

  it("generates stable users key", () => {
    expect(dashboardKeys.users("30d", "org-1")).toEqual(["admin-dashboard", "users", "30d", "org-1"]);
  });

  it("generates stable chat key", () => {
    expect(dashboardKeys.chat("7d", null)).toEqual(["admin-dashboard", "chat", "7d", null]);
  });

  it("generates stable orgs key", () => {
    expect(dashboardKeys.orgs(null)).toEqual(["admin-dashboard", "orgs", null]);
  });

  it("has stable availableOrgs key", () => {
    expect(dashboardKeys.availableOrgs).toEqual(["admin-dashboard", "available-orgs"]);
  });
});

describe("useOverviewStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns overview data on success", async () => {
    const data = { totalUsers: 42, bannedUsers: 1 };
    mockGetOverview.mockResolvedValue(data);

    const { result } = renderHook(() => useOverviewStats(null), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockGetOverview).toHaveBeenCalledWith(null);
  });

  it("passes organizationId to service", async () => {
    mockGetOverview.mockResolvedValue({});

    const { result } = renderHook(() => useOverviewStats("org-1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetOverview).toHaveBeenCalledWith("org-1");
  });
});

describe("useUserStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user stats data", async () => {
    const data = { total: 10, newInRange: 3 };
    mockGetUserStats.mockResolvedValue(data);

    const { result } = renderHook(() => useUserStats("30d", null), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockGetUserStats).toHaveBeenCalledWith("30d", null);
  });

  it("passes organizationId to service", async () => {
    mockGetUserStats.mockResolvedValue({});

    const { result } = renderHook(() => useUserStats("7d", "org-2"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetUserStats).toHaveBeenCalledWith("7d", "org-2");
  });
});

describe("useChatStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns chat stats data", async () => {
    const data = { totalConversations: 5 };
    mockGetChatStats.mockResolvedValue(data);

    const { result } = renderHook(() => useChatStats("90d", null), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockGetChatStats).toHaveBeenCalledWith("90d", null);
  });
});

describe("useOrgStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns org stats data", async () => {
    const data = { totalOrganizations: 2 };
    mockGetOrgStats.mockResolvedValue(data);

    const { result } = renderHook(() => useOrgStats(null), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });

  it("passes organizationId", async () => {
    mockGetOrgStats.mockResolvedValue({});

    const { result } = renderHook(() => useOrgStats("org-5"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetOrgStats).toHaveBeenCalledWith("org-5");
  });
});

describe("useAvailableOrgs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns available orgs list", async () => {
    const orgs = [{ id: "org-1", name: "Org One", slug: "org-one" }];
    mockGetAvailableOrganizations.mockResolvedValue(orgs);

    const { result } = renderHook(() => useAvailableOrgs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(orgs);
  });
});
