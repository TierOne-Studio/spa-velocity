import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseAuth = vi.fn();
const mockUsePermissionsContext = vi.fn();

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

vi.mock("@shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => mockUsePermissionsContext(),
}));

import { AdminRoute } from "../AdminRoute";

const authenticatedAdmin = {
  isAuthenticated: true,
  isAdminOrManager: true,
};

const authenticatedMember = {
  isAuthenticated: true,
  isAdminOrManager: false,
};

const unauthenticated = {
  isAuthenticated: false,
  isAdminOrManager: false,
};

const permissionsGranted = { can: () => true };
const permissionsDenied = { can: () => false };

describe("AdminRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children for admin/manager user", () => {
    mockUseAuth.mockReturnValue(authenticatedAdmin);
    mockUsePermissionsContext.mockReturnValue(permissionsGranted);

    render(
      <AdminRoute>
        <div data-testid="child">Admin Content</div>
      </AdminRoute>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue(unauthenticated);
    mockUsePermissionsContext.mockReturnValue(permissionsGranted);

    render(
      <AdminRoute>
        <div data-testid="child">Admin Content</div>
      </AdminRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/login");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("redirects to fallbackPath when authenticated but not admin/manager", () => {
    mockUseAuth.mockReturnValue(authenticatedMember);
    mockUsePermissionsContext.mockReturnValue(permissionsGranted);

    render(
      <AdminRoute fallbackPath="/dashboard">
        <div data-testid="child">Admin Content</div>
      </AdminRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/dashboard");
  });

  it("redirects to default fallback '/' when no fallbackPath provided", () => {
    mockUseAuth.mockReturnValue(authenticatedMember);
    mockUsePermissionsContext.mockReturnValue(permissionsGranted);

    render(
      <AdminRoute>
        <div data-testid="child">Admin Content</div>
      </AdminRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/");
  });

  it("redirects when requiredPermission is not granted", () => {
    mockUseAuth.mockReturnValue(authenticatedAdmin);
    mockUsePermissionsContext.mockReturnValue(permissionsDenied);

    render(
      <AdminRoute requiredPermission={{ resource: "user", action: "create" }}>
        <div data-testid="child">Admin Content</div>
      </AdminRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("renders children when requiredPermission is granted", () => {
    mockUseAuth.mockReturnValue(authenticatedAdmin);
    mockUsePermissionsContext.mockReturnValue(permissionsGranted);

    render(
      <AdminRoute requiredPermission={{ resource: "user", action: "read" }}>
        <div data-testid="child">Admin Content</div>
      </AdminRoute>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });
});
