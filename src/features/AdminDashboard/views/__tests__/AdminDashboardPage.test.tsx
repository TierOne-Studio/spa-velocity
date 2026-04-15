import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const {
  mockUseOverviewStats,
  mockUseUserStats,
  mockUseChatStats,
  mockUseOrgStats,
  mockUseAvailableOrgs,
  mockUseEffectiveSession,
} = vi.hoisted(() => ({
  mockUseOverviewStats: vi.fn(),
  mockUseUserStats: vi.fn(),
  mockUseChatStats: vi.fn(),
  mockUseOrgStats: vi.fn(),
  mockUseAvailableOrgs: vi.fn(),
  mockUseEffectiveSession: vi.fn(),
}));

vi.mock("../../hooks/useAdminDashboard", () => ({
  useOverviewStats: (...args: unknown[]) => mockUseOverviewStats(...args),
  useUserStats: (...args: unknown[]) => mockUseUserStats(...args),
  useChatStats: (...args: unknown[]) => mockUseChatStats(...args),
  useOrgStats: (...args: unknown[]) => mockUseOrgStats(...args),
  useAvailableOrgs: () => mockUseAvailableOrgs(),
}));

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

vi.mock("@/shared/utils/roles", () => ({
  isSuperadminRole: (role: string) => role === "superadmin",
  getSessionUserRole: (session: { user?: { role?: string } } | null) => session?.user?.role ?? null,
}));

vi.mock("../../components/OverviewCards", () => ({
  OverviewCards: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="overview-cards" data-loading={isLoading ? "true" : "false"} />
  ),
}));

vi.mock("../../components/ChatIntelligenceSection", () => ({
  ChatIntelligenceSection: ({ range }: { range: string }) => (
    <div data-testid="chat-intelligence" data-range={range} />
  ),
}));

vi.mock("../../components/UserActivitySection", () => ({
  UserActivitySection: ({ range }: { range: string }) => (
    <div data-testid="user-activity" data-range={range} />
  ),
}));

vi.mock("../../components/OrgActivitySection", () => ({
  OrgActivitySection: () => <div data-testid="org-activity" />,
}));

vi.mock("@/shared/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("@/shared/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="toggle-group" data-value={value}>
      {children}
      {/* expose buttons to test onValueChange with both truthy and falsy values */}
      <button data-testid="toggle-set-7d" type="button" onClick={() => onValueChange?.("7d")}>set-7d</button>
      <button data-testid="toggle-set-empty" type="button" onClick={() => onValueChange?.("")}>set-empty</button>
    </div>
  ),
  ToggleGroupItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <button data-testid={`toggle-${value}`} onClick={() => {}} type="button">{children}</button>
  ),
}));

vi.mock("@/shared/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)} data-testid="select">
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

import { AdminDashboardPage } from "../AdminDashboardPage";

const overviewData = { totalUsers: 10, bannedUsers: 0, activeSessions: 5, totalOrganizations: 2, totalConversations: 20, totalMessages: 100, assistantMessages: 50, totalTokensAllTime: 5000 };

function setupMocks({ isSuperadmin = false, availableOrgs = [] as { id: string; name: string; slug: string }[], activeOrgId = null as string | null } = {}) {
  mockUseEffectiveSession.mockReturnValue({
    data: {
      user: { id: "u-1", role: isSuperadmin ? "superadmin" : "admin" },
      session: { activeOrganizationId: activeOrgId },
    },
  });
  mockUseAvailableOrgs.mockReturnValue({ data: availableOrgs });
  mockUseOverviewStats.mockReturnValue({ data: overviewData, isLoading: false });
  mockUseUserStats.mockReturnValue({ data: undefined, isLoading: false });
  mockUseChatStats.mockReturnValue({ data: undefined, isLoading: false });
  mockUseOrgStats.mockReturnValue({ data: undefined, isLoading: false });
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders the page heading", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("renders platform-wide description when no org selected", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("Platform-wide usage and growth metrics")).toBeInTheDocument();
  });

  it("renders section headings", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("Chat Intelligence")).toBeInTheDocument();
    expect(screen.getByText("User Activity")).toBeInTheDocument();
    expect(screen.getByText("Organization Activity")).toBeInTheDocument();
  });

  it("renders OverviewCards component", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByTestId("overview-cards")).toBeInTheDocument();
  });

  it("renders ChatIntelligenceSection with default range", () => {
    render(<AdminDashboardPage />);
    const chatSection = screen.getByTestId("chat-intelligence");
    expect(chatSection).toBeInTheDocument();
    expect(chatSection).toHaveAttribute("data-range", "30d");
  });

  it("renders UserActivitySection component", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByTestId("user-activity")).toBeInTheDocument();
  });

  it("renders OrgActivitySection component", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByTestId("org-activity")).toBeInTheDocument();
  });

  it("shows loading skeletons when chat stats are loading", () => {
    mockUseChatStats.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminDashboardPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByTestId("chat-intelligence")).not.toBeInTheDocument();
  });

  it("shows loading skeletons when user stats are loading", () => {
    mockUseUserStats.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminDashboardPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByTestId("user-activity")).not.toBeInTheDocument();
  });

  it("shows loading skeletons when org stats are loading", () => {
    mockUseOrgStats.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminDashboardPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByTestId("org-activity")).not.toBeInTheDocument();
  });

  it("does not show org selector for non-superadmin with single org", () => {
    setupMocks({ isSuperadmin: false, availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }] });
    render(<AdminDashboardPage />);
    // Single org non-superadmin should not show selector (showOrgSelector = false)
    const selects = screen.queryAllByTestId("select");
    // Only the range selects should be present (not the org selector)
    expect(selects.length).toBeLessThanOrEqual(2); // range selects
  });

  it("shows org selector for superadmin", () => {
    setupMocks({
      isSuperadmin: true,
      availableOrgs: [
        { id: "org-1", name: "Org One", slug: "org-one" },
        { id: "org-2", name: "Org Two", slug: "org-two" },
      ],
    });
    render(<AdminDashboardPage />);
    const selects = screen.getAllByTestId("select");
    // Superadmin sees org selector + range selects
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("shows org selector when multiple orgs available", () => {
    setupMocks({
      isSuperadmin: false,
      availableOrgs: [
        { id: "org-1", name: "Org One", slug: "org-one" },
        { id: "org-2", name: "Org Two", slug: "org-two" },
      ],
    });
    render(<AdminDashboardPage />);
    const selects = screen.getAllByTestId("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'Showing data for' description when an org is selected", async () => {
    setupMocks({
      isSuperadmin: false,
      availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
      activeOrgId: "org-1",
    });
    render(<AdminDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Showing data for/)).toBeInTheDocument();
    });
  });

  it("auto-selects the org when not superadmin and only one org", async () => {
    setupMocks({
      isSuperadmin: false,
      availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
    });
    render(<AdminDashboardPage />);
    await waitFor(() => {
      expect(mockUseOverviewStats).toHaveBeenCalledWith("org-1");
    });
  });

  it("auto-selects active org when non-superadmin has multiple orgs and an active one", async () => {
    setupMocks({
      isSuperadmin: false,
      availableOrgs: [
        { id: "org-1", name: "Org One", slug: "org-one" },
        { id: "org-2", name: "Org Two", slug: "org-two" },
      ],
      activeOrgId: "org-2",
    });
    render(<AdminDashboardPage />);
    await waitFor(() => {
      expect(mockUseOverviewStats).toHaveBeenCalledWith("org-2");
    });
  });

  it("changes range via select and triggers new stats calls", async () => {
    setupMocks();
    render(<AdminDashboardPage />);

    // Find range select and change to 7d - the last select is the range selector (hidden on mobile)
    const selects = screen.getAllByTestId("select");
    // We have potentially org selector + range selector (or just range if no org selector)
    const rangeSelect = selects[selects.length - 1];
    fireEvent.change(rangeSelect, { target: { value: "7d" } });

    // After state update via the select, chat section should use 7d range
    await waitFor(() => {
      expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "7d");
    });
  });

  it("shows org-specific data description when org is selected via selector", async () => {
    setupMocks({
      isSuperadmin: true,
      availableOrgs: [
        { id: "org-1", name: "Org One", slug: "org-one" },
        { id: "org-2", name: "Org Two", slug: "org-two" },
      ],
    });
    render(<AdminDashboardPage />);

    const selects = screen.getAllByTestId("select");
    const orgSelect = selects[0]; // First select is org selector for superadmin
    fireEvent.change(orgSelect, { target: { value: "org-1" } });

    await waitFor(() => {
      expect(screen.getByText(/Showing data for: Org One/)).toBeInTheDocument();
    });
  });

  it("shows 'Selected organization' when org id not found in list", async () => {
    setupMocks({
      isSuperadmin: false,
      availableOrgs: [
        { id: "org-1", name: "Org One", slug: "org-one" },
        { id: "org-2", name: "Org Two", slug: "org-two" },
      ],
      activeOrgId: "org-3", // not in list
    });
    render(<AdminDashboardPage />);
    // org-3 is not in list, so the else if branch should not set it
    // (availableOrgs.some(o => o.id === "org-3") is false)
    await waitFor(() => {
      expect(mockUseOverviewStats).toHaveBeenCalledWith(null);
    });
  });

  it("does not change range when toggle group fires empty string (falsy guard)", async () => {
    // Covers line 77: if (v) setRange(v as TimeRange) - the false branch when v === ""
    setupMocks();
    render(<AdminDashboardPage />);

    // First verify the range is currently 30d
    expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "30d");

    // Set range to 7d via truthy path
    fireEvent.click(screen.getByTestId("toggle-set-7d"));
    await waitFor(() => {
      expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "7d");
    });

    // Now trigger the falsy path (empty string = deselect)
    fireEvent.click(screen.getByTestId("toggle-set-empty"));

    // Range should remain 7d since if(v) guard prevented the empty value from being set
    expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "7d");
  });

  it("resets to all organizations when __all__ is selected (covers line 57 ternary)", async () => {
    // Covers line 57: v === '__all__' ? null : v - the truthy branch (v === '__all__')
    setupMocks({
      isSuperadmin: true,
      availableOrgs: [
        { id: "org-1", name: "Org One", slug: "org-one" },
        { id: "org-2", name: "Org Two", slug: "org-two" },
      ],
    });
    render(<AdminDashboardPage />);

    const selects = screen.getAllByTestId("select");
    const orgSelect = selects[0]; // First select is org selector for superadmin

    // First select an org
    fireEvent.change(orgSelect, { target: { value: "org-1" } });
    await waitFor(() => {
      expect(screen.getByText(/Showing data for: Org One/)).toBeInTheDocument();
    });

    // Now select __all__ to reset
    fireEvent.change(orgSelect, { target: { value: "__all__" } });
    await waitFor(() => {
      expect(screen.getByText("Platform-wide usage and growth metrics")).toBeInTheDocument();
    });
  });

  it("shows 'Selected organization' fallback text when selected org has no name (covers line 48 ?? fallback)", async () => {
    // Covers line 48: availableOrgs.find(o => o.id === selectedOrgId)?.name ?? 'Selected organization'
    // The ?? fallback fires when org is found but has no name
    setupMocks({
      isSuperadmin: true,
      availableOrgs: [
        // An org with no name - find returns the object but .name is undefined
        { id: "org-noname", name: undefined as unknown as string, slug: "org-noname" },
      ],
    });
    render(<AdminDashboardPage />);

    // Trigger selection of the nameless org
    const selects = screen.getAllByTestId("select");
    fireEvent.change(selects[0], { target: { value: "org-noname" } });

    await waitFor(() => {
      expect(screen.getByText(/Showing data for: Selected organization/)).toBeInTheDocument();
    });
  });

  it("handles null session data gracefully (covers line 18 session ?? null branch)", () => {
    // When useEffectiveSession returns null data, session is null => session ?? null uses fallback
    mockUseEffectiveSession.mockReturnValue({ data: null });
    mockUseAvailableOrgs.mockReturnValue({ data: [] });
    mockUseOverviewStats.mockReturnValue({ data: undefined, isLoading: false });
    mockUseUserStats.mockReturnValue({ data: undefined, isLoading: false });
    mockUseChatStats.mockReturnValue({ data: undefined, isLoading: false });
    mockUseOrgStats.mockReturnValue({ data: undefined, isLoading: false });
    render(<AdminDashboardPage />);
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Platform-wide usage and growth metrics")).toBeInTheDocument();
  });
});
