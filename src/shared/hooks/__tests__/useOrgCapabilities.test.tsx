import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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

import { useOrgCapabilities } from "../useOrgCapabilities";

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

describe("useOrgCapabilities", () => {
  beforeEach(() => {
    mockUseEffectiveSession.mockReset();
    mockFetchWithAuth.mockReset();
  });

  it("identifies a superadmin", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "sa-1", role: "superadmin" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([]);

    const { result } = renderHook(() => useOrgCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSuperadmin).toBe(true);
    expect(result.current.isMultiOrgMember).toBe(false);
    expect(result.current.isSingleOrgMember).toBe(false);
    expect(result.current.activeOrganizationId).toBe(null);
  });

  it("identifies a single-org member", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "u-1", role: "member" },
        session: { activeOrganizationId: "org-1" },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([{ id: "org-1", name: "Acme", slug: "acme" }]);

    const { result } = renderHook(() => useOrgCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSuperadmin).toBe(false);
    expect(result.current.isSingleOrgMember).toBe(true);
    expect(result.current.isMultiOrgMember).toBe(false);
    expect(result.current.memberOrganizations).toHaveLength(1);
    expect(result.current.activeOrganizationId).toBe("org-1");
  });

  it("identifies a multi-org member", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "u-1", role: "member" },
        session: { activeOrganizationId: "org-1" },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([
      { id: "org-1", name: "Acme", slug: "acme" },
      { id: "org-2", name: "Globex", slug: "globex" },
    ]);

    const { result } = renderHook(() => useOrgCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isMultiOrgMember).toBe(true);
    expect(result.current.isSingleOrgMember).toBe(false);
    expect(result.current.memberOrganizations).toHaveLength(2);
  });

  it("reports loading while memberships query is pending", () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "u-1", role: "member" },
        session: { activeOrganizationId: "org-1" },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOrgCapabilities(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.memberOrganizations).toEqual([]);
  });

  it("treats a comma-separated role string as superadmin when it contains superadmin", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "u-1", role: "admin,superadmin" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: vi.fn(),
    });
    mockMemberships([]);

    const { result } = renderHook(() => useOrgCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSuperadmin).toBe(true);
  });
});
