import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { ALL_ORGANIZATIONS_VALUE } from "@/shared/constants/org-scope";

const {
  mockUseOverviewStats,
  mockUseUserStats,
  mockUseChatStats,
  mockUseOrgStats,
  mockUseAvailableOrgs,
  mockUseOrgCapabilities,
  mockUseOrgScope,
} = vi.hoisted(() => ({
  mockUseOverviewStats: vi.fn(),
  mockUseUserStats: vi.fn(),
  mockUseChatStats: vi.fn(),
  mockUseOrgStats: vi.fn(),
  mockUseAvailableOrgs: vi.fn(),
  mockUseOrgCapabilities: vi.fn(),
  mockUseOrgScope: vi.fn(),
}));

vi.mock("../../hooks/useAdminDashboard", () => ({
  useOverviewStats: (...args: unknown[]) => mockUseOverviewStats(...args),
  useUserStats: (...args: unknown[]) => mockUseUserStats(...args),
  useChatStats: (...args: unknown[]) => mockUseChatStats(...args),
  useOrgStats: (...args: unknown[]) => mockUseOrgStats(...args),
  useAvailableOrgs: () => mockUseAvailableOrgs(),
}));

vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => mockUseOrgCapabilities(),
}));

vi.mock("@/shared/hooks/useOrgScope", () => ({
  useOrgScope: () => mockUseOrgScope(),
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
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)} data-testid="range-select">
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

// Use the real SystemViewBanner and ViewingScopePicker; they respect the
// mocked `useOrgCapabilities` and render deterministic markup.
vi.mock("@/shared/components/SystemViewBanner", () => ({
  SystemViewBanner: ({ visible, message }: { visible: boolean; message?: string }) =>
    visible ? (
      <div data-testid="system-view-banner">
        {message ?? "System view: showing data across all organizations."}
      </div>
    ) : null,
}));

vi.mock("@/shared/components/ViewingScopePicker", () => ({
  ViewingScopePicker: ({
    value,
    onChange,
    organizations,
  }: {
    value: string | null;
    onChange: (v: string) => void;
    organizations: { id: string; name: string }[];
  }) => {
    // Render only when superadmin — pages control the render, but our mock
    // doesn't check capabilities; this matches the page's unconditional drop-in
    // (the real picker returns null for non-superadmin, verified in its own test).
    const caps = mockUseOrgCapabilities();
    if (!caps.isSuperadmin) return null;
    return (
      <select
        data-testid="viewing-scope-picker"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={ALL_ORGANIZATIONS_VALUE}>All organizations</option>
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  },
}));

import { AdminDashboardPage } from "../AdminDashboardPage";

const overviewData = {
  totalUsers: 10,
  bannedUsers: 0,
  activeSessions: 5,
  totalOrganizations: 2,
  totalConversations: 20,
  totalMessages: 100,
  assistantMessages: 50,
  totalTokensAllTime: 5000,
};

type ScopeShape = {
  mode: "all" | "single";
  selectedValue: string | null;
  organizationId: string | null;
  setSelectedValue: ReturnType<typeof vi.fn>;
  toQuery: ReturnType<typeof vi.fn>;
};

function makeScope(overrides: Partial<ScopeShape> = {}): ScopeShape {
  const mode = overrides.mode ?? "single";
  const organizationId =
    overrides.organizationId !== undefined ? overrides.organizationId : null;
  const selectedValue =
    overrides.selectedValue !== undefined
      ? overrides.selectedValue
      : mode === "all"
        ? ALL_ORGANIZATIONS_VALUE
        : organizationId;
  return {
    mode,
    selectedValue,
    organizationId,
    setSelectedValue: vi.fn(),
    toQuery: vi.fn(() =>
      mode === "all"
        ? { scope: "all" as const }
        : organizationId
          ? { organizationId }
          : {},
    ),
  };
}

function setupMocks({
  isSuperadmin = false,
  availableOrgs = [] as { id: string; name: string; slug: string }[],
  activeOrganizationId = null as string | null,
  scope,
}: {
  isSuperadmin?: boolean;
  availableOrgs?: { id: string; name: string; slug: string }[];
  activeOrganizationId?: string | null;
  scope?: ScopeShape;
} = {}) {
  mockUseOrgCapabilities.mockReturnValue({
    isSuperadmin,
    isMultiOrgMember: false,
    isSingleOrgMember: false,
    memberOrganizations: [],
    activeOrganizationId,
    isLoading: false,
  });

  const effectiveScope =
    scope ??
    makeScope(
      isSuperadmin
        ? { mode: "all" }
        : { mode: "single", organizationId: activeOrganizationId },
    );
  mockUseOrgScope.mockReturnValue(effectiveScope);

  mockUseAvailableOrgs.mockReturnValue({ data: availableOrgs });
  mockUseOverviewStats.mockReturnValue({ data: overviewData, isLoading: false });
  mockUseUserStats.mockReturnValue({ data: undefined, isLoading: false });
  mockUseChatStats.mockReturnValue({ data: undefined, isLoading: false });
  mockUseOrgStats.mockReturnValue({ data: undefined, isLoading: false });

  return effectiveScope;
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

  it("renders section headings", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText("Chat Intelligence")).toBeInTheDocument();
    expect(screen.getByText("User Activity")).toBeInTheDocument();
    expect(screen.getByText("Organization Activity")).toBeInTheDocument();
  });

  it("renders OverviewCards, ChatIntelligenceSection, UserActivitySection, and OrgActivitySection", () => {
    render(<AdminDashboardPage />);
    expect(screen.getByTestId("overview-cards")).toBeInTheDocument();
    const chatSection = screen.getByTestId("chat-intelligence");
    expect(chatSection).toHaveAttribute("data-range", "30d");
    expect(screen.getByTestId("user-activity")).toBeInTheDocument();
    expect(screen.getByTestId("org-activity")).toBeInTheDocument();
  });

  it("shows loading skeletons when chat stats are loading", () => {
    mockUseChatStats.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminDashboardPage />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("chat-intelligence")).not.toBeInTheDocument();
  });

  it("shows loading skeletons when user stats are loading", () => {
    mockUseUserStats.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminDashboardPage />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("user-activity")).not.toBeInTheDocument();
  });

  it("shows loading skeletons when org stats are loading", () => {
    mockUseOrgStats.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminDashboardPage />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("org-activity")).not.toBeInTheDocument();
  });

  describe("non-superadmin", () => {
    it("does not render the viewing scope picker", () => {
      setupMocks({
        isSuperadmin: false,
        availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
        activeOrganizationId: "org-1",
      });
      render(<AdminDashboardPage />);
      expect(screen.queryByTestId("viewing-scope-picker")).not.toBeInTheDocument();
    });

    it("does not render the system view banner", () => {
      setupMocks({ isSuperadmin: false, activeOrganizationId: "org-1" });
      render(<AdminDashboardPage />);
      expect(screen.queryByTestId("system-view-banner")).not.toBeInTheDocument();
    });

    it("shows 'Showing data for' description when scoped to an org", () => {
      setupMocks({
        isSuperadmin: false,
        availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
        activeOrganizationId: "org-1",
        scope: makeScope({ mode: "single", organizationId: "org-1" }),
      });
      render(<AdminDashboardPage />);
      expect(screen.getByText(/Showing data for: Org One/)).toBeInTheDocument();
    });

    it("passes the scoped organization id to data hooks", () => {
      setupMocks({
        isSuperadmin: false,
        availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
        activeOrganizationId: "org-1",
        scope: makeScope({ mode: "single", organizationId: "org-1" }),
      });
      render(<AdminDashboardPage />);
      expect(mockUseOverviewStats).toHaveBeenCalledWith("org-1");
      expect(mockUseUserStats).toHaveBeenCalledWith("30d", "org-1");
      expect(mockUseChatStats).toHaveBeenCalledWith("30d", "org-1");
      expect(mockUseOrgStats).toHaveBeenCalledWith("org-1");
    });
  });

  describe("superadmin", () => {
    it("renders the viewing scope picker", () => {
      setupMocks({
        isSuperadmin: true,
        availableOrgs: [
          { id: "org-1", name: "Org One", slug: "org-one" },
          { id: "org-2", name: "Org Two", slug: "org-two" },
        ],
      });
      render(<AdminDashboardPage />);
      expect(screen.getByTestId("viewing-scope-picker")).toBeInTheDocument();
    });

    it("renders the SystemViewBanner when scope.mode === 'all'", () => {
      setupMocks({
        isSuperadmin: true,
        scope: makeScope({ mode: "all" }),
      });
      render(<AdminDashboardPage />);
      expect(screen.getByTestId("system-view-banner")).toBeInTheDocument();
      expect(
        screen.getByText("Platform-wide usage and growth metrics"),
      ).toBeInTheDocument();
    });

    it("hides the SystemViewBanner when a single org is scoped", () => {
      setupMocks({
        isSuperadmin: true,
        availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
        scope: makeScope({ mode: "single", organizationId: "org-1" }),
      });
      render(<AdminDashboardPage />);
      expect(screen.queryByTestId("system-view-banner")).not.toBeInTheDocument();
      expect(screen.getByText(/Showing data for: Org One/)).toBeInTheDocument();
    });

    it("passes null to data hooks when scope.mode === 'all'", () => {
      setupMocks({
        isSuperadmin: true,
        scope: makeScope({ mode: "all" }),
      });
      render(<AdminDashboardPage />);
      expect(mockUseOverviewStats).toHaveBeenCalledWith(null);
      expect(mockUseOrgStats).toHaveBeenCalledWith(null);
    });

    it("delegates viewing-scope changes to scope.setSelectedValue", () => {
      const scope = makeScope({ mode: "all" });
      setupMocks({
        isSuperadmin: true,
        availableOrgs: [
          { id: "org-1", name: "Org One", slug: "org-one" },
          { id: "org-2", name: "Org Two", slug: "org-two" },
        ],
        scope,
      });
      render(<AdminDashboardPage />);
      fireEvent.change(screen.getByTestId("viewing-scope-picker"), {
        target: { value: "org-1" },
      });
      expect(scope.setSelectedValue).toHaveBeenCalledWith("org-1");
    });

    it("shows 'Selected organization' fallback when the scoped org is not in availableOrgs", () => {
      setupMocks({
        isSuperadmin: true,
        availableOrgs: [{ id: "org-1", name: "Org One", slug: "org-one" }],
        scope: makeScope({ mode: "single", organizationId: "org-unknown" }),
      });
      render(<AdminDashboardPage />);
      expect(
        screen.getByText(/Showing data for: Selected organization/),
      ).toBeInTheDocument();
    });

    it("shows 'Selected organization' fallback when the scoped org has no name", () => {
      setupMocks({
        isSuperadmin: true,
        availableOrgs: [
          { id: "org-noname", name: undefined as unknown as string, slug: "org-noname" },
        ],
        scope: makeScope({ mode: "single", organizationId: "org-noname" }),
      });
      render(<AdminDashboardPage />);
      expect(
        screen.getByText(/Showing data for: Selected organization/),
      ).toBeInTheDocument();
    });
  });

  it("changes range via select and propagates to chat section", async () => {
    render(<AdminDashboardPage />);
    const rangeSelect = screen.getByTestId("range-select");
    fireEvent.change(rangeSelect, { target: { value: "7d" } });
    await waitFor(() => {
      expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "7d");
    });
  });

  it("does not change range when toggle group fires empty string (falsy guard)", async () => {
    render(<AdminDashboardPage />);
    expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "30d");
    fireEvent.click(screen.getByTestId("toggle-set-7d"));
    await waitFor(() => {
      expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "7d");
    });
    fireEvent.click(screen.getByTestId("toggle-set-empty"));
    expect(screen.getByTestId("chat-intelligence")).toHaveAttribute("data-range", "7d");
  });
});
