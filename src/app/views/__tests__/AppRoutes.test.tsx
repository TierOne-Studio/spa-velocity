import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockLoginPage = vi.fn(() => <div data-testid="login-page">Login Page</div>);

vi.mock("@features/Auth", () => ({
  LoginPage: () => mockLoginPage(),
  SignupPage: () => <div data-testid="signup-page">Signup Page</div>,
  VerifyEmailPage: () => <div>Verify Email</div>,
  ForgotPasswordPage: () => <div>Forgot Password</div>,
  SetNewPasswordPage: () => <div>Set New Password</div>,
  AcceptInvitationPage: () => <div>Accept Invitation</div>,
  PendingApprovalPage: () => <div>Pending Approval</div>,
  AccountRejectedPage: () => <div>Account Rejected</div>,
}));

vi.mock("@features/Dashboard", () => ({
  SettingsPage: () => <div>Settings</div>,
  AccountPage: () => <div>Account</div>,
}));

vi.mock("@features/Admin", () => ({
  UsersPage: () => <div>Users</div>,
  SessionsPage: () => <div>Sessions</div>,
  OrganizationsPage: () => <div>Organizations</div>,
  RolesPage: () => <div>Roles</div>,
}));

vi.mock("@features/Chat", () => ({
  ChatPage: () => <div>Chat</div>,
}));

vi.mock("@features/Projects", () => ({
  ProjectsPage: () => <div>Projects Page</div>,
}));

vi.mock("../RootLayout", async () => {
  const router = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    default: () => (
      <div>
        <div>Root Layout</div>
        <router.Outlet />
      </div>
    ),
  };
});

vi.mock("@shared/components/ui", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@shared/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("@shared/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@shared/context/PermissionsContext", () => ({
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@shared/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@shared/components/AdminRoute", () => ({
  AdminRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AppRoutes from "../AppRoutes";

describe("AppRoutes", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/login");
    mockLoginPage.mockImplementation(() => <div data-testid="login-page">Login Page</div>);
  });

  it("renders login route and toaster", () => {
    render(<AppRoutes />);

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("renders fallback UI when a route component throws", () => {
    mockLoginPage.mockImplementation(() => {
      throw new Error("route failed");
    });

    render(<AppRoutes />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the chat route", () => {
    window.history.pushState({}, "", "/chat");

    render(<AppRoutes />);

    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("redirects the index route to chat", () => {
    window.history.pushState({}, "", "/");

    render(<AppRoutes />);

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("redirects the legacy dashboard route to chat", () => {
    window.history.pushState({}, "", "/dashboard");

    render(<AppRoutes />);

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("renders the projects route", () => {
    window.history.pushState({}, "", "/projects");

    render(<AppRoutes />);

    expect(screen.getByText("Projects Page")).toBeInTheDocument();
  });

});
