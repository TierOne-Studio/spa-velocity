import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRotate = vi.fn();
const mockDelete = vi.fn();
vi.mock("../../services/embedSitesService", () => ({
  createEmbedSite: (...a: unknown[]) => mockCreate(...a),
  updateEmbedSite: (...a: unknown[]) => mockUpdate(...a),
  rotateEmbedSiteKey: (...a: unknown[]) => mockRotate(...a),
  deleteEmbedSite: (...a: unknown[]) => mockDelete(...a),
}));

import {
  useCreateEmbedSite,
  useDeleteEmbedSite,
  useRotateEmbedSiteKey,
  useUpdateEmbedSite,
} from "../useEmbedSiteMutations";
import { embedSiteKeys } from "../embedSiteKeys";

afterEach(() => vi.clearAllMocks());

function wrapperWithSpy() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, invalidateSpy };
}

const site = { id: "site-1", publicKey: "wgt_pub_x" };

describe("embed-site mutations invalidate the feature list on success", () => {
  it("useCreateEmbedSite invalidates embedSiteKeys.all", async () => {
    mockCreate.mockResolvedValue(site);
    const { wrapper, invalidateSpy } = wrapperWithSpy();
    const { result } = renderHook(() => useCreateEmbedSite(), { wrapper });
    await result.current.mutateAsync({ name: "x", projectId: "p", allowedOrigins: [] });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: embedSiteKeys.all }),
    );
  });

  it("useUpdateEmbedSite invalidates embedSiteKeys.all", async () => {
    mockUpdate.mockResolvedValue(site);
    const { wrapper, invalidateSpy } = wrapperWithSpy();
    const { result } = renderHook(() => useUpdateEmbedSite(), { wrapper });
    await result.current.mutateAsync({ id: "site-1", input: { enabled: false } });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: embedSiteKeys.all }),
    );
  });

  it("useRotateEmbedSiteKey invalidates embedSiteKeys.all", async () => {
    mockRotate.mockResolvedValue(site);
    const { wrapper, invalidateSpy } = wrapperWithSpy();
    const { result } = renderHook(() => useRotateEmbedSiteKey(), { wrapper });
    await result.current.mutateAsync("site-1");
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: embedSiteKeys.all }),
    );
  });

  it("useDeleteEmbedSite invalidates embedSiteKeys.all", async () => {
    mockDelete.mockResolvedValue(undefined);
    const { wrapper, invalidateSpy } = wrapperWithSpy();
    const { result } = renderHook(() => useDeleteEmbedSite(), { wrapper });
    await result.current.mutateAsync("site-1");
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: embedSiteKeys.all }),
    );
  });
});
