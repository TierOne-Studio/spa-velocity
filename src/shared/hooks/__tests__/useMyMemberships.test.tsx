import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("@shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import { useMyMemberships, MY_MEMBERSHIPS_QUERY_KEY } from "../useMyMemberships";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useMyMemberships", () => {
  beforeEach(() => {
    mockFetchWithAuth.mockReset();
  });

  it("returns an array payload directly", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "org-1", name: "Acme", slug: "acme" },
        { id: "org-2", name: "Globex", slug: "globex" },
      ],
    });

    const { result } = renderHook(() => useMyMemberships(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([
      { id: "org-1", name: "Acme", slug: "acme" },
      { id: "org-2", name: "Globex", slug: "globex" },
    ]);
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/organization/list"),
    );
  });

  it("unwraps payloads under the `data` key", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: "org-1", name: "Acme", slug: "acme" }],
      }),
    });

    const { result } = renderHook(() => useMyMemberships(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: "org-1", name: "Acme", slug: "acme" },
    ]);
  });

  it("unwraps payloads under the `organizations` key", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        organizations: [{ id: "org-1", name: "Acme", slug: "acme" }],
      }),
    });

    const { result } = renderHook(() => useMyMemberships(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: "org-1", name: "Acme", slug: "acme" },
    ]);
  });

  it("returns an empty array when the payload is not recognizable", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ not: "a list" }),
    });

    const { result } = renderHook(() => useMyMemberships(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces errors from non-ok responses", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Unauthorized" }),
    });

    const { result } = renderHook(() => useMyMemberships(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Unauthorized");
  });

  it("falls back to a default error message when error JSON is empty", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useMyMemberships(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "Failed to list organizations",
    );
  });

  it("exports a stable query key usable for external invalidation", () => {
    expect(MY_MEMBERSHIPS_QUERY_KEY).toEqual(["auth", "organization", "list"]);
  });
});
