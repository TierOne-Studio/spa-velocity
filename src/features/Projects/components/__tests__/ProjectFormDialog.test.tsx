import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockUseEffectiveSession,
  mockUseOrganizations,
  mockUseAirweaveCollections,
  mockUseVectorDbs,
  mockCreateMutate,
  mockUpdateMutate,
  mockAddSourceMutate,
  mockRemoveSourceMutate,
} = vi.hoisted(() => ({
  mockUseEffectiveSession: vi.fn(),
  mockUseOrganizations: vi.fn(),
  mockUseAirweaveCollections: vi.fn(),
  mockUseVectorDbs: vi.fn(),
  mockCreateMutate: vi.fn(),
  mockUpdateMutate: vi.fn(),
  mockAddSourceMutate: vi.fn(),
  mockRemoveSourceMutate: vi.fn(),
}));

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

// Derive `useOrgCapabilities` off the existing `useEffectiveSession` fixture
// so this component test doesn't need a QueryClientProvider for the real
// memberships fetch. For non-superadmin callers with an active organization,
// synthesize a single membership — that matches the common real-world shape
// and lets OrgTargetField exercise its single-org-member branch.
vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => {
    const session = mockUseEffectiveSession();
    const role: string | null = session?.data?.user?.role ?? null;
    const activeOrganizationId: string | null =
      session?.data?.session?.activeOrganizationId ?? null;
    const isSuperadmin = role === "superadmin";
    const memberOrganizations =
      !isSuperadmin && activeOrganizationId
        ? [
            {
              id: activeOrganizationId,
              name: `Org ${activeOrganizationId}`,
              slug: activeOrganizationId,
            },
          ]
        : [];
    return {
      isSuperadmin,
      isMultiOrgMember: !isSuperadmin && memberOrganizations.length > 1,
      isSingleOrgMember: !isSuperadmin && memberOrganizations.length === 1,
      memberOrganizations,
      activeOrganizationId,
      isLoading: false,
    };
  },
}));

vi.mock("@/features/Admin/hooks/useOrganizations", () => ({
  useOrganizations: () => mockUseOrganizations(),
  // Non-superadmin path inside ProjectFormDialog falls back to useOrganization()
  // because the orgs list query is disabled for them. Resolve from the same
  // fixture so existing tests keep passing without extra setup.
  useOrganization: (organizationId: string) => {
    if (!organizationId) return { data: undefined, isLoading: false };
    const list = mockUseOrganizations()?.data?.data ?? [];
    const match = list.find((o: { id: string }) => o.id === organizationId);
    return { data: match, isLoading: false };
  },
}));

vi.mock("@/features/Admin/hooks/useAirweaveCollections", () => ({
  useAirweaveCollections: () => mockUseAirweaveCollections(),
}));

vi.mock("@/features/Admin/hooks/useSqlConnections", () => ({
  useSqlConnections: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/features/VectorDb/hooks/useVectorDbs", () => ({
  useVectorDbs: () => mockUseVectorDbs(),
}));

vi.mock("../../hooks/useProjects", () => ({
  useCreateProject: () => ({ mutateAsync: mockCreateMutate, isPending: false }),
  useUpdateProject: () => ({ mutateAsync: mockUpdateMutate, isPending: false }),
  useAddProjectSource: () => ({ mutateAsync: mockAddSourceMutate, isPending: false }),
  useRemoveProjectSource: () => ({
    mutateAsync: mockRemoveSourceMutate,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ProjectFormDialog } from "../ProjectFormDialog";

const collections = [
  { id: "c1", name: "Alpha", readableId: "alpha", organizationId: "org-1", createdAt: "", updatedAt: "", status: null, sourceConnectionCount: 0 },
  { id: "c2", name: "Beta", readableId: "beta", organizationId: "org-1", createdAt: "", updatedAt: "", status: null, sourceConnectionCount: 0 },
  { id: "c3", name: "Gamma", readableId: "gamma", organizationId: "org-2", createdAt: "", updatedAt: "", status: null, sourceConnectionCount: 0 },
];

function makeVectorDb(id: string, name: string, status: string) {
  return {
    id,
    organizationId: "org-1",
    name,
    description: null,
    vectorStoreKind: "qdrant",
    vectorStoreRef: `vdb_${id}`,
    status,
    statusError: null,
    documentCount: 0,
    version: 1,
    processingStartedAt: null,
    lastIngestedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

const vectorDbs = [
  makeVectorDb("vdb-1", "Handbook", "ready"),
  makeVectorDb("vdb-2", "Drafts", "empty"),
];

function setSession(role: string) {
  mockUseEffectiveSession.mockReturnValue({
    data: {
      user: { id: "user-1", role },
      session: { activeOrganizationId: "org-1" },
    },
  });
}

describe("ProjectFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession("manager");
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org One", slug: "org-1", metadata: { allowedAirweaveCollectionIds: ["alpha", "beta"] }, createdAt: new Date() },
          { id: "org-2", name: "Org Two", slug: "org-2", metadata: { allowedAirweaveCollectionIds: ["gamma"] }, createdAt: new Date() },
        ],
      },
    });
    mockUseAirweaveCollections.mockReturnValue({
      data: collections,
      isLoading: false,
    });
    mockUseVectorDbs.mockReturnValue({
      data: vectorDbs,
      isLoading: false,
    });
  });

  it("create mode: submits name + selected collections as initialSources", async () => {
    const user = userEvent.setup();
    mockCreateMutate.mockResolvedValue({ id: "p1" });
    const onOpenChange = vi.fn();

    render(<ProjectFormDialog open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/name/i), "New Project");

    // Open collections combobox and pick Alpha
    await user.click(
      screen.getByRole("button", { name: /select collections/i }),
    );
    await user.click(await screen.findByRole("option", { name: /alpha/i }));
    // close popover
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId("project-form-submit"));

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith({
        organizationId: "org-1",
        name: "New Project",
        description: null,
        initialSources: [
          {
            kind: "airweave_collection",
            name: "Alpha",
            config: { collectionReadableId: "alpha", collectionName: "Alpha" },
          },
        ],
      });
    });
  });

  it("create mode: single-org non-superadmin sees no Organization picker", () => {
    // With the shared OrgTargetField, single-org members get no dropdown in
    // create mode — the target is unambiguous (their one org) and the form
    // still submits with `activeOrganizationId` via the existing useEffect.
    render(<ProjectFormDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId("project-organization")).not.toBeInTheDocument();
  });

  it("non-superadmin: collections are filtered to the org's allowlist", async () => {
    const user = userEvent.setup();
    render(<ProjectFormDialog open={true} onOpenChange={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: /select collections/i }),
    );

    expect(await screen.findByRole("option", { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /beta/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /gamma/i })).not.toBeInTheDocument();
  });

  it("superadmin: sees all collections regardless of org allowlist", async () => {
    const user = userEvent.setup();
    setSession("superadmin");
    render(<ProjectFormDialog open={true} onOpenChange={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: /select collections/i }),
    );

    expect(await screen.findByRole("option", { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /beta/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /gamma/i })).toBeInTheDocument();
  });

  it("edit mode: Organization field is disabled and adds/removes diffed sources", async () => {
    const user = userEvent.setup();
    mockUpdateMutate.mockResolvedValue({ id: "p1" });
    mockAddSourceMutate.mockResolvedValue({ id: "s2" });
    mockRemoveSourceMutate.mockResolvedValue(undefined);

    const project = {
      id: "p1",
      organizationId: "org-1",
      name: "Old",
      description: null,
      createdByUserId: "user-1",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      sourceCount: 1,
      conversationCount: 0,
      sources: [
        {
          id: "src-alpha",
          projectId: "p1",
          kind: "airweave_collection" as const,
          name: "Alpha",
          config: { collectionReadableId: "alpha", collectionName: "Alpha" },
          status: "ready" as const,
          statusDetail: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    };

    render(
      <ProjectFormDialog open={true} onOpenChange={vi.fn()} project={project} />,
    );

    // Edit mode renders OrgTargetField's read-only fallback: the field is
    // present (so the user sees which org owns the project) but no editable
    // select/input is rendered.
    const orgField = screen.getByTestId("project-organization");
    expect(orgField).toBeInTheDocument();
    expect(orgField).toHaveTextContent(/Org One/i);
    expect(
      screen.queryByTestId("project-organization-trigger"),
    ).not.toBeInTheDocument();

    // Deselect alpha and select beta via combobox (trigger shows Alpha badge)
    await user.click(
      screen.getByRole("button", { name: /select collections/i }),
    );
    // Alpha is selected — click option to remove
    await user.click(await screen.findByRole("option", { name: /alpha/i }));
    // Beta is unselected — click option to add
    await user.click(screen.getByRole("option", { name: /beta/i }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId("project-form-submit"));

    await waitFor(() => {
      expect(mockAddSourceMutate).toHaveBeenCalledWith({
        projectId: "p1",
        input: {
          kind: "airweave_collection",
          name: "Beta",
          config: { collectionReadableId: "beta", collectionName: "Beta" },
        },
        organizationId: "org-1",
      });
      expect(mockRemoveSourceMutate).toHaveBeenCalledWith({
        projectId: "p1",
        sourceId: "src-alpha",
        organizationId: "org-1",
      });
    });
    // Name unchanged → update not called
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it("create mode: submits selected vector databases as initialSources", async () => {
    const user = userEvent.setup();
    mockCreateMutate.mockResolvedValue({ id: "p1" });

    render(<ProjectFormDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText(/name/i), "RAG Project");

    await user.click(
      screen.getByRole("button", { name: /select vector databases/i }),
    );
    await user.click(await screen.findByRole("option", { name: /handbook/i }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId("project-form-submit"));

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith({
        organizationId: "org-1",
        name: "RAG Project",
        description: null,
        initialSources: [
          {
            kind: "vector_db",
            name: "Handbook",
            config: { vectorDbId: "vdb-1", vectorDbName: "Handbook" },
          },
        ],
      });
    });
  });

  it("create mode: offers non-ready vector databases too", async () => {
    const user = userEvent.setup();
    render(<ProjectFormDialog open={true} onOpenChange={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: /select vector databases/i }),
    );

    // Both a ready and an empty (non-ready) KB are selectable.
    expect(
      await screen.findByRole("option", { name: /handbook/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /drafts/i })).toBeInTheDocument();
  });

  it("edit mode: adds and removes diffed vector_db sources", async () => {
    const user = userEvent.setup();
    mockAddSourceMutate.mockResolvedValue({ id: "s2" });
    mockRemoveSourceMutate.mockResolvedValue(undefined);

    const project = {
      id: "p1",
      organizationId: "org-1",
      name: "Old",
      description: null,
      createdByUserId: "user-1",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      sourceCount: 1,
      conversationCount: 0,
      sources: [
        {
          id: "src-vdb-1",
          projectId: "p1",
          kind: "vector_db" as const,
          name: "Handbook",
          config: { vectorDbId: "vdb-1", vectorDbName: "Handbook" },
          status: "ready" as const,
          statusDetail: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    };

    render(
      <ProjectFormDialog open={true} onOpenChange={vi.fn()} project={project} />,
    );

    await user.click(
      screen.getByRole("button", { name: /select vector databases/i }),
    );
    // Handbook attached → click to remove; Drafts unattached → click to add.
    await user.click(await screen.findByRole("option", { name: /handbook/i }));
    await user.click(screen.getByRole("option", { name: /drafts/i }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId("project-form-submit"));

    await waitFor(() => {
      expect(mockAddSourceMutate).toHaveBeenCalledWith({
        projectId: "p1",
        input: {
          kind: "vector_db",
          name: "Drafts",
          config: { vectorDbId: "vdb-2", vectorDbName: "Drafts" },
        },
        organizationId: "org-1",
      });
      expect(mockRemoveSourceMutate).toHaveBeenCalledWith({
        projectId: "p1",
        sourceId: "src-vdb-1",
        organizationId: "org-1",
      });
    });
  });
});
