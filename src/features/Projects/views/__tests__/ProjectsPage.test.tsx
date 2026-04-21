import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const {
  mockUseProjects,
  mockUseProject,
  mockUseDeleteProject,
  mockUseEffectiveSession,
  mockUseOrganizations,
  mockDeleteMutate,
} = vi.hoisted(() => ({
  mockUseProjects: vi.fn(),
  mockUseProject: vi.fn(),
  mockUseDeleteProject: vi.fn(),
  mockUseEffectiveSession: vi.fn(),
  mockUseOrganizations: vi.fn(),
  mockDeleteMutate: vi.fn(),
}));

vi.mock("../../hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
  useProject: (...args: unknown[]) => mockUseProject(...args),
  useDeleteProject: () => mockUseDeleteProject(),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddProjectSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveProjectSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

// Mirror real `useOrgCapabilities` extraction (role + active org) off the
// existing `useEffectiveSession` fixture so we don't need to stand up a React
// Query client for `useMyMemberships` in this component-only test.
vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => {
    const session = mockUseEffectiveSession();
    const role: string | null = session?.data?.user?.role ?? null;
    const activeOrganizationId: string | null =
      session?.data?.session?.activeOrganizationId ?? null;
    return {
      isSuperadmin: role === "superadmin",
      isMultiOrgMember: false,
      isSingleOrgMember: false,
      memberOrganizations: [],
      activeOrganizationId,
      isLoading: false,
    };
  },
}));

vi.mock("@/features/Admin/hooks/useOrganizations", () => ({
  useOrganizations: (...args: unknown[]) => mockUseOrganizations(...args),
}));

vi.mock("@/features/Admin/hooks/useAirweaveCollections", () => ({
  useAirweaveCollections: () => ({ data: [], isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ProjectsPage } from "../ProjectsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

const sampleProjects = [
  {
    id: "p1",
    organizationId: "org-1",
    name: "Research",
    description: "Deep dives",
    createdByUserId: "user-1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    sourceCount: 2,
    conversationCount: 3,
  },
  {
    id: "p2",
    organizationId: "org-1",
    name: "Onboarding",
    description: null,
    createdByUserId: "user-1",
    createdAt: "2026-01-02",
    updatedAt: "2026-01-02",
    sourceCount: 0,
    conversationCount: 0,
  },
];

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "user-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
    });
    mockUseOrganizations.mockReturnValue({ data: { data: [] } });
    mockUseProjects.mockReturnValue({
      data: sampleProjects,
      isLoading: false,
      error: null,
    });
    mockUseProject.mockReturnValue({ data: null });
    mockUseDeleteProject.mockReturnValue({
      mutateAsync: mockDeleteMutate,
      isPending: false,
    });
  });

  it("renders projects rows", () => {
    renderPage();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("filters rows by search value", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/search projects/i), "Resear");

    await waitFor(() => {
      expect(screen.getByText("Research")).toBeInTheDocument();
      expect(screen.queryByText("Onboarding")).not.toBeInTheDocument();
    });
  });

  it("opens the form dialog when the New project button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("projects-new-button"));

    expect(screen.getByTestId("project-form-dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /new project/i })).toBeInTheDocument();
  });

  it("opens the row action menu and confirms delete flow", async () => {
    const user = userEvent.setup();
    mockDeleteMutate.mockResolvedValue(undefined);

    renderPage();

    await user.click(screen.getByTestId("project-row-actions-p1"));
    await user.click(screen.getByTestId("project-delete-p1"));

    expect(
      await screen.findByRole("alertdialog", { name: /delete this project/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("project-delete-confirm"));

    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith({
        id: "p1",
        organizationId: "org-1",
      });
    });
  });

  it("shows an error banner when loading fails", () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Boom"),
    });
    renderPage();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
