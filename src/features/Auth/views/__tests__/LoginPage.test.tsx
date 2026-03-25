import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

const { mockUseAuth, mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}));

vi.mock("@shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import LoginPage from "../LoginPage";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
    });

    mockLogin.mockResolvedValue(undefined);
  });

  it("shows validation error and prevents submit when email format is invalid", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "invalid-email");
    await user.type(screen.getByLabelText(/password/i), "password123");

    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
  });

  it("submits login credentials when form values are valid", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");

    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("calls toast.error when login throws", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("shows fallback 'Login failed' when a non-Error is thrown — covers instanceof branch", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue("string error");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Login failed");
    });
  });

  it("redirects to dashboard when already authenticated", async () => {
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("redirects to accept-invitation when pendingInvitationId is in sessionStorage", async () => {
    sessionStorage.setItem("pendingInvitationId", "inv-123");
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/accept-invitation/inv-123", { replace: true });
    });

    sessionStorage.removeItem("pendingInvitationId");
  });

  it("removes pendingInvitationId and navigates after successful form submit with pending invitation", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("pendingInvitationId", "inv-456");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/accept-invitation/inv-456", { replace: true });
    });

    expect(sessionStorage.getItem("pendingInvitationId")).toBeNull();
  });
});
