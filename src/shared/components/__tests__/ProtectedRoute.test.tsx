import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => mockNavigate,
}));

vi.mock("@shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { ProtectedRoute } from "../ProtectedRoute";

describe("ProtectedRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a loading state while auth status is still resolving", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("route-guard-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { approvalStatus: "approved" },
    });

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/login");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("redirects pending users to /pending-approval", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { approvalStatus: "pending" },
    });

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/pending-approval");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("redirects rejected users to /account-rejected", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { approvalStatus: "rejected" },
    });

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/account-rejected");
    expect(screen.queryByTestId("child")).toBeNull();
  });
});
