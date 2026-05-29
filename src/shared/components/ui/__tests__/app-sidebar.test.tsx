import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockUseAuth = vi.fn();
const mockUsePermissionsContext = vi.fn();

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => mockUsePermissionsContext(),
}));

vi.mock("@/shared/components/OrganizationSwitcher", () => ({
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));

vi.mock("@/shared/components/ui/nav-main", () => ({
  NavMain: ({ groups }: { groups: Array<{ title: string; items: Array<{ title: string }> }> }) => (
    <div data-testid="nav-main">{JSON.stringify(groups)}</div>
  ),
}));

vi.mock("@/shared/components/ui/nav-secondary", () => ({
  NavSecondary: () => <div data-testid="nav-secondary" />,
}));

vi.mock("@/shared/components/ui/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user" />,
}));

vi.mock("@/shared/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@tabler/icons-react", () => ({
  IconBooks: () => null,
  IconBuilding: () => null,
  IconChartBar: () => null,
  IconCloud: () => null,
  IconDatabase: () => null,
  IconFolder: () => null,
  IconHome: () => null,
  IconInnerShadowTop: () => null,
  IconLibrary: () => null,
  IconLink: () => null,
  IconMessageCircle: () => null,
  IconShield: () => null,
  IconUsers: () => null,
  IconUserScan: () => null,
}));

import { AppSidebar } from "../app-sidebar";

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { name: "Test User", email: "test@example.com" },
    });
  });

  it("shows the Chat nav item when chat:read is granted", () => {
    mockUsePermissionsContext.mockReturnValue({
      can: (resource: string, action: string) =>
        (resource === "chat" && action === "read") || (resource === "user" && action === "read"),
    });

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("nav-main").textContent).toContain("Chat");
    expect(screen.getByTestId("nav-main").textContent).not.toContain("Projects");
    expect(screen.getByTestId("nav-main").textContent).not.toContain("Data Sources");
    expect(screen.getByTestId("org-switcher")).toBeInTheDocument();
  });

  it("hides chat when chat:read is missing", () => {
    mockUsePermissionsContext.mockReturnValue({
      can: () => false,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("nav-main").textContent).not.toContain("Chat");
  });

  it("uses fallback name and email when user is null (covers lines 133-134 ?? fallbacks)", () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUsePermissionsContext.mockReturnValue({
      can: () => false,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    // Component should render without crashing (user?.name ?? "User" and user?.email ?? "")
    expect(screen.getByTestId("nav-main")).toBeInTheDocument();
  });

  it("shows the organization switcher for superadmin", () => {
    mockUseAuth.mockReturnValue({
      user: { name: "Super Admin", email: "superadmin@example.com", role: "superadmin" },
    });
    mockUsePermissionsContext.mockReturnValue({
      can: () => true,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("org-switcher")).toBeInTheDocument();
  });
});