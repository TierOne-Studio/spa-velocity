import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockMutateAsync = vi.fn();
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
  useUpdateEmbedSite: () => ({ mutateAsync: mockMutateAsync }),
}));
vi.mock("@/shared/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

import { EditEmbedSiteDialog } from "../EditEmbedSiteDialog";
import type { EmbedSite } from "../../types";

const site: EmbedSite = {
  id: "site-1",
  name: "Acme",
  projectId: "proj-1",
  publicKey: "wgt_pub_x",
  allowedOrigins: ["https://a.com", "https://b.com"],
  enabled: true,
  theme: null,
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z",
};

beforeEach(() => {
  mockMutateAsync.mockReset().mockResolvedValue(undefined);
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  onOpenChange.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("EditEmbedSiteDialog", () => {
  it("prefills name, newline-joined origins, and the enabled checkbox from the site", () => {
    render(<EditEmbedSiteDialog site={site} open onOpenChange={onOpenChange} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Acme");
    expect(screen.getByLabelText(/allowed origins/i)).toHaveValue(
      "https://a.com\nhttps://b.com",
    );
    expect(screen.getByLabelText(/enabled/i)).toBeChecked();
  });

  it("submits the edited name, parsed origins, and toggled-off enabled flag", async () => {
    render(<EditEmbedSiteDialog site={site} open onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByLabelText(/enabled/i)); // toggle off
    const name = screen.getByLabelText(/^name$/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Acme Renamed");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: "site-1",
      input: {
        name: "Acme Renamed",
        allowedOrigins: ["https://a.com", "https://b.com"],
        enabled: false,
      },
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
