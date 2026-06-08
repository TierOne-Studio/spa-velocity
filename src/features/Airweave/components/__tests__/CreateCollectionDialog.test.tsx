import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ────────────────────────────────────────────────────────────────
// OrgTargetField → useOrgCapabilities pulls in useEffectiveSession/useQuery;
// mock the capabilities hook so the dialog renders without a QueryClient.
const { mockUseOrgCapabilities, mockCreate, mockNavigate, mockUseOrganizations } =
  vi.hoisted(() => ({
    mockUseOrgCapabilities: vi.fn(),
    mockCreate: vi.fn(),
    mockNavigate: vi.fn(),
    mockUseOrganizations: vi.fn(),
  }));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => mockUseOrgCapabilities(),
}));

vi.mock("@/features/Admin/hooks/useOrganizations", () => ({
  useOrganizations: () => mockUseOrganizations(),
}));

vi.mock("@/features/Airweave/hooks/useCreateAirweaveCollection", () => ({
  useCreateAirweaveCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CreateCollectionDialog } from "../CreateCollectionDialog";

function singleOrgCaps() {
  return {
    isSuperadmin: false,
    isMultiOrgMember: false,
    isSingleOrgMember: true,
    memberOrganizations: [{ id: "org-1", name: "Org One", slug: "org-1" }],
    activeOrganizationId: "org-1",
    isLoading: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseOrgCapabilities.mockReturnValue(singleOrgCaps());
  mockUseOrganizations.mockReturnValue({ data: { data: [] } });
  mockCreate.mockResolvedValue({ name: "KB", readableId: "org-1-kb-abcd1234" });
});

describe("CreateCollectionDialog — org picker (ADR-011 amendment 5/6)", () => {
  it("hides the org picker for a single-org member and creates in their org", async () => {
    const user = userEvent.setup();
    render(<CreateCollectionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.queryByTestId("create-collection-org")).toBeNull();

    await user.type(screen.getByLabelText(/^name$/i), "KB");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "KB", organizationId: "org-1" }),
      );
    });
  });

  it("shows the org picker for a multi-org member and forwards the owning org", async () => {
    mockUseOrgCapabilities.mockReturnValue({
      ...singleOrgCaps(),
      isMultiOrgMember: true,
      isSingleOrgMember: false,
      memberOrganizations: [
        { id: "org-1", name: "Org One", slug: "org-1" },
        { id: "org-2", name: "Org Two", slug: "org-2" },
      ],
    });
    const user = userEvent.setup();
    render(<CreateCollectionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("create-collection-org")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name$/i), "KB");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // Defaults to the active org (org-1); a multi-org user could pick another
    // via the picker. The point: organizationId is forwarded, not omitted.
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "KB", organizationId: "org-1" }),
      );
    });
  });

  it("renders the picker with the full org list for a superadmin", () => {
    mockUseOrgCapabilities.mockReturnValue({
      ...singleOrgCaps(),
      isSuperadmin: true,
      isSingleOrgMember: false,
      memberOrganizations: [],
      activeOrganizationId: "org-1",
    });
    mockUseOrganizations.mockReturnValue({
      data: { data: [{ id: "org-9", name: "Any Org" }] },
    });
    render(<CreateCollectionDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("create-collection-org")).toBeInTheDocument();
  });
});
