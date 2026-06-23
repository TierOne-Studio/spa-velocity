import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockDeleteAsync = vi.fn();
const mockRotateAsync = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const onOpenChange = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));
vi.mock("../../hooks/useEmbedSiteMutations", () => ({
  useDeleteEmbedSite: () => ({ mutateAsync: mockDeleteAsync, isPending: false }),
  useRotateEmbedSiteKey: () => ({ mutateAsync: mockRotateAsync, isPending: false }),
}));

import { DeleteEmbedSiteDialog } from "../DeleteEmbedSiteDialog";
import { RotateKeyDialog } from "../RotateKeyDialog";
import type { EmbedSite } from "../../types";

const site: EmbedSite = {
  id: "site-1",
  name: "Acme",
  projectId: "proj-1",
  publicKey: "wgt_pub_x",
  allowedOrigins: ["https://a.com"],
  enabled: true,
  theme: null,
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z",
};

beforeEach(() => {
  mockDeleteAsync.mockReset();
  mockRotateAsync.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  onOpenChange.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("DeleteEmbedSiteDialog", () => {
  it("deletes, toasts success, and closes", async () => {
    mockDeleteAsync.mockResolvedValue(undefined);
    render(<DeleteEmbedSiteDialog site={site} open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteAsync).toHaveBeenCalledWith("site-1"));
    expect(mockToastSuccess).toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("surfaces a delete failure as an error toast", async () => {
    mockDeleteAsync.mockRejectedValue(new Error("Cannot delete"));
    render(<DeleteEmbedSiteDialog site={site} open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Cannot delete"));
  });
});

describe("RotateKeyDialog", () => {
  it("rotates, toasts success, and closes", async () => {
    mockRotateAsync.mockResolvedValue({ ...site, publicKey: "wgt_pub_new" });
    render(<RotateKeyDialog site={site} open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: /rotate key/i }));
    await waitFor(() => expect(mockRotateAsync).toHaveBeenCalledWith("site-1"));
    expect(mockToastSuccess).toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("surfaces a rotate failure as an error toast", async () => {
    mockRotateAsync.mockRejectedValue(new Error("Rotate failed"));
    render(<RotateKeyDialog site={site} open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: /rotate key/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Rotate failed"));
  });
});
