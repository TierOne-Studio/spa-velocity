import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockUseSession = vi.fn();
const mockFetchWithAuth = vi.fn();

vi.mock("@shared/lib/auth-client", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import { useEffectiveSession } from "../useEffectiveSession";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useEffectiveSession", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockFetchWithAuth.mockReset();
    localStorage.clear();
  });

  it("returns Better Auth session when not using custom impersonation", () => {
    const refetch = vi.fn();
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" },
        session: {},
      },
      isPending: false,
      refetch,
    });

    const { result } = renderHook(() => useEffectiveSession(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data?.user?.email).toBe("admin@example.com");
    expect(result.current.isPending).toBe(false);
    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it("returns bearer-backed session during custom impersonation", async () => {
    const refetch = vi.fn();
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" },
        session: {},
      },
      isPending: false,
      refetch,
    });

    localStorage.setItem("bearer_token", "impersonated-token");
    localStorage.setItem("original_bearer_token", "original-token");
    localStorage.setItem("impersonation_mode", "custom");

    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: "member-1", email: "member@example.com", name: "Member", role: "member" },
        session: { impersonatedBy: "admin-1", activeOrganizationId: "org-1" },
      }),
    });

    const { result } = renderHook(() => useEffectiveSession(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.user?.email).toBe("member@example.com");
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(expect.stringContaining("/api/auth/get-session"));
  });
});
