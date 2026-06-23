import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockCan = vi.fn();
const mockUseEmbedSites = vi.fn();
const mockUseProjects = vi.fn();

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => ({ can: mockCan }),
}));
vi.mock("../../hooks/useEmbedSites", () => ({
  useEmbedSites: () => mockUseEmbedSites(),
}));
vi.mock("@features/Projects", () => ({
  useProjects: () => mockUseProjects(),
}));
// Render the Radix dropdown inline so menu items are queryable without opening
// (the repo's established test pattern for Radix primitives).
vi.mock("@/shared/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import React from "react";
import { EmbedSitesPage } from "../EmbedSitesPage";
import type { EmbedSite } from "../../types";

const site: EmbedSite = {
  id: "site-1",
  name: "Acme Widget",
  projectId: "proj-1",
  publicKey: "wgt_pub_abc",
  allowedOrigins: ["https://acme.com"],
  enabled: true,
  theme: null,
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EmbedSitesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCan.mockReset();
  mockUseEmbedSites.mockReturnValue({ data: [site], isLoading: false, isError: false });
  mockUseProjects.mockReturnValue({ data: [{ id: "proj-1", name: "Acme Docs" }] });
});

describe("EmbedSitesPage", () => {
  it("renders the widget row with its linked project name", () => {
    mockCan.mockReturnValue(false);
    renderPage();
    expect(screen.getByText("Acme Widget")).toBeInTheDocument();
    expect(screen.getByText("Acme Docs")).toBeInTheDocument();
    expect(screen.getByText("wgt_pub_abc")).toBeInTheDocument();
  });

  it("hides the Create widget button when the user lacks embed-site:create", () => {
    mockCan.mockImplementation(() => false);
    renderPage();
    expect(
      screen.queryByRole("button", { name: /create widget/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Create widget button when the user has embed-site:create", () => {
    mockCan.mockImplementation((r: string, a: string) => r === "embed-site" && a === "create");
    renderPage();
    expect(
      screen.getByRole("button", { name: /create widget/i }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no widgets", () => {
    mockCan.mockReturnValue(false);
    mockUseEmbedSites.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText(/no widgets yet/i)).toBeInTheDocument();
  });

  it("shows an error state when the query fails", () => {
    mockCan.mockReturnValue(false);
    mockUseEmbedSites.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
    });
    renderPage();
    expect(screen.getByText(/failed to load widgets/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });

  it("admin (all scopes) sees Get code + Edit + Rotate key + Delete in the row menu", () => {
    mockCan.mockReturnValue(true);
    renderPage();
    expect(screen.getByRole("button", { name: /get embed code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("manager (update, no delete) sees Edit + Rotate key but NOT Delete", () => {
    mockCan.mockImplementation(
      (r: string, a: string) =>
        r === "embed-site" && (a === "read" || a === "create" || a === "update"),
    );
    renderPage();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rotate key/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^delete$/i }),
    ).not.toBeInTheDocument();
  });

  it("read-only member sees only Get embed code (no Edit/Rotate/Delete)", () => {
    mockCan.mockImplementation((r: string, a: string) => r === "embed-site" && a === "read");
    renderPage();
    expect(screen.getByRole("button", { name: /get embed code/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rotate key/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });
});
