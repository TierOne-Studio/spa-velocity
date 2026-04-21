import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockUseEffectiveSession = vi.fn();
const mockFetchWithAuth = vi.fn();

vi.mock("@shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import { useOrgScope } from "../useOrgScope";
import { ALL_ORGANIZATIONS_VALUE } from "../../constants/org-scope";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

function mockMemberships(orgs: Array<{ id: string; name: string; slug: string }>) {
  mockFetchWithAuth.mockResolvedValue({
    ok: true,
    json: async () => orgs,
  });
}

describe("useOrgScope", () => {
  beforeEach(() => {
    mockUseEffectiveSession.mockReset();
    mockFetchWithAuth.mockReset();
  });

  it("defaults superadmin to mode=all with the __all__ sentinel", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "sa-1", role: "superadmin" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([]);

    const { result } = renderHook(() => useOrgScope(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mode).toBe("all");
    expect(result.current.selectedValue).toBe(ALL_ORGANIZATIONS_VALUE);
    expect(result.current.organizationId).toBe(null);
    expect(result.current.toQuery()).toEqual({ scope: "all" });
  });

  it("respects a superadminDefaultMode override", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "sa-1", role: "superadmin" },
        session: { activeOrganizationId: "org-active" },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([]);

    const { result } = renderHook(
      () => useOrgScope({ superadminDefaultMode: "single" }),
      { wrapper: createWrapper() },
    );

    expect(result.current.mode).toBe("single");
    expect(result.current.selectedValue).toBe("org-active");
    expect(result.current.organizationId).toBe("org-active");
    expect(result.current.toQuery()).toEqual({ organizationId: "org-active" });
  });

  it("pins non-superadmin to their active organization", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "u-1", role: "member" },
        session: { activeOrganizationId: "org-1" },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([{ id: "org-1", name: "Acme", slug: "acme" }]);

    const { result } = renderHook(() => useOrgScope(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mode).toBe("single");
    expect(result.current.selectedValue).toBe("org-1");
    expect(result.current.toQuery()).toEqual({ organizationId: "org-1" });
  });

  it("ignores setSelectedValue for non-superadmin callers", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "u-1", role: "member" },
        session: { activeOrganizationId: "org-1" },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([{ id: "org-1", name: "Acme", slug: "acme" }]);

    const { result } = renderHook(() => useOrgScope(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setSelectedValue(ALL_ORGANIZATIONS_VALUE));
    expect(result.current.selectedValue).toBe("org-1");
  });

  it("lets superadmin switch from all to a specific org", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "sa-1", role: "superadmin" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([]);

    const { result } = renderHook(() => useOrgScope(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedValue).toBe(
      ALL_ORGANIZATIONS_VALUE,
    ));

    act(() => result.current.setSelectedValue("org-42"));

    expect(result.current.mode).toBe("single");
    expect(result.current.organizationId).toBe("org-42");
    expect(result.current.toQuery()).toEqual({ organizationId: "org-42" });
  });

  it("returns an empty query when mode is single but no org is selected", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "sa-1", role: "superadmin" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([]);

    const { result } = renderHook(
      () => useOrgScope({ superadminDefaultMode: "single" }),
      { wrapper: createWrapper() },
    );

    expect(result.current.mode).toBe("single");
    expect(result.current.organizationId).toBe(null);
    expect(result.current.toQuery()).toEqual({});
  });
});
