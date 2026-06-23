import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

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
  useCreateEmbedSite: () => ({ mutateAsync: mockMutateAsync }),
}));
vi.mock("@features/Projects", () => ({
  useProjects: () => ({
    data: [{ id: "proj-1", name: "Acme Docs" }],
    isLoading: false,
  }),
}));
// Render the Radix Select as a native <select> so the picker is drivable in jsdom
// (the repo's established test pattern for Radix primitives).
vi.mock("@/shared/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select
      data-testid="project-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

import { EmbedSiteApiError } from "../../lib/apiResponse";
import { CreateEmbedSiteDialog } from "../CreateEmbedSiteDialog";

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  onOpenChange.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("CreateEmbedSiteDialog", () => {
  it("parses the origins textarea to a deduped array and submits, then closes on success", async () => {
    mockMutateAsync.mockResolvedValue({ name: "Acme", publicKey: "wgt_pub_x" });
    render(<CreateEmbedSiteDialog open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText(/^name$/i), "Acme");
    await userEvent.selectOptions(screen.getByTestId("project-select"), "proj-1");
    await userEvent.type(
      screen.getByLabelText(/allowed origins/i),
      "https://a.com\nhttps://a.com\nhttps://b.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      name: "Acme",
      projectId: "proj-1",
      allowedOrigins: ["https://a.com", "https://b.com"],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("surfaces the 409 project-conflict message as an error toast and stays open", async () => {
    mockMutateAsync.mockRejectedValue(
      new EmbedSiteApiError("Project already has an embed site", 409, null),
    );
    render(<CreateEmbedSiteDialog open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText(/^name$/i), "Acme");
    await userEvent.selectOptions(screen.getByTestId("project-select"), "proj-1");
    await userEvent.type(screen.getByLabelText(/allowed origins/i), "https://a.com");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Project already has an embed site"),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("blocks submit (no mutation) when no project is selected", async () => {
    render(<CreateEmbedSiteDialog open onOpenChange={onOpenChange} />);
    await userEvent.type(screen.getByLabelText(/^name$/i), "Acme");
    await userEvent.type(screen.getByLabelText(/allowed origins/i), "https://a.com");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(screen.getByText(/project is required/i)).toBeInTheDocument(),
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
