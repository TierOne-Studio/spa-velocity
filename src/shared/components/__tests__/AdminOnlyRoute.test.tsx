import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseAuth = vi.fn();

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

vi.mock("@shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { AdminOnlyRoute } from "../AdminOnlyRoute";

describe("AdminOnlyRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children for authenticated user", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });

    render(
      <AdminOnlyRoute>
        <div data-testid="child">Admin Only Content</div>
      </AdminOnlyRoute>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    render(
      <AdminOnlyRoute>
        <div data-testid="child">Admin Only Content</div>
      </AdminOnlyRoute>,
    );

    const nav = screen.getByTestId("navigate");
    expect(nav.getAttribute("data-to")).toBe("/login");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("renders children for authenticated non-admin user", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });

    render(
      <AdminOnlyRoute>
        <div data-testid="child">Admin Only Content</div>
      </AdminOnlyRoute>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });

    const { container } = render(
      <AdminOnlyRoute>
        <div data-testid="child">Admin Only Content</div>
      </AdminOnlyRoute>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("child")).toBeNull();
    expect(screen.queryByTestId("navigate")).toBeNull();
  });
});
