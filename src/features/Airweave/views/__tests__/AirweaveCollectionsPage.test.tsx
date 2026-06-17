import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AirweaveCollection } from "@/features/Airweave/types";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockUseAirweaveCollections, mockCan, mockNavigate } = vi.hoisted(
  () => ({
    mockUseAirweaveCollections: vi.fn(),
    mockCan: vi.fn(),
    mockNavigate: vi.fn(),
  }),
);

vi.mock("@/features/Admin/hooks/useAirweaveCollections", () => ({
  useAirweaveCollections: mockUseAirweaveCollections,
}));

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => ({ can: mockCan }),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Stub the dialog components — they have their own deep deps (RHF, etc.)
// that aren't relevant to the page-level rendering / gating tests.
vi.mock("@/features/Airweave/components/CreateAirweaveCollectionDialog", () => ({
  CreateAirweaveCollectionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="stub-create-dialog" /> : null,
}));
vi.mock("@/features/Airweave/components/RenameAirweaveCollectionDialog", () => ({
  RenameAirweaveCollectionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="stub-rename-dialog" /> : null,
}));
vi.mock("@/features/Airweave/components/DeleteAirweaveCollectionDialog", () => ({
  DeleteAirweaveCollectionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="stub-delete-dialog" /> : null,
}));

import { AirweaveCollectionsPage } from "../AirweaveCollectionsPage";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const collectionFixture: AirweaveCollection = {
  id: "c1",
  name: "Knowledge Base",
  readableId: "acme-kb-deadbeef",
  organizationId: "org-1",
  createdAt: "2026-05-25T00:00:00.000Z",
  updatedAt: "2026-05-25T00:00:00.000Z",
  status: "active",
  sourceConnectionCount: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAirweaveCollections.mockReturnValue({
    data: [collectionFixture],
    isLoading: false,
    isError: false,
    error: null,
  });
  mockCan.mockReturnValue(false);
});

describe("AirweaveCollectionsPage", () => {
  it("renders the header and description", () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    expect(
      screen.getByRole("heading", { name: /airweave collections/i }),
    ).toBeInTheDocument();
  });

  it("hides the Create button when the user lacks airweave:create (member role)", () => {
    mockCan.mockImplementation(() => false);
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    expect(
      screen.queryByRole("button", { name: /create airweave collection/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Create button when the user has airweave:create", () => {
    mockCan.mockImplementation(
      (resource: string, action: string) =>
        resource === "airweave" && action === "create",
    );
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    expect(
      screen.getByRole("button", { name: /create airweave collection/i }),
    ).toBeInTheDocument();
  });

  it("renders a row per collection with the readable id and source-count", () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("acme-kb-deadbeef")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("navigates to the detail page when a row is clicked", () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    fireEvent.click(
      screen.getByRole("link", { name: /manage airweave collection knowledge base/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/admin/airweave/acme-kb-deadbeef",
    );
  });

  it("shows the empty-state message when no collections exist", () => {
    mockUseAirweaveCollections.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    expect(
      screen.getByText(/no airweave collections yet\. click create airweave collection/i),
    ).toBeInTheDocument();
  });

  it("hides the row action menu entirely when the user lacks update + delete", () => {
    mockCan.mockReturnValue(false);
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <AirweaveCollectionsPage />
      </Wrapper>,
    );
    expect(
      screen.queryByRole("button", {
        name: /actions for knowledge base/i,
      }),
    ).not.toBeInTheDocument();
  });
});
