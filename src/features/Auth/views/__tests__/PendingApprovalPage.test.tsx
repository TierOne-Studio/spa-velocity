import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseAuth, mockNavigate, mockRefreshSession, mockLogout } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockLogout: vi.fn(),
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

import { PendingApprovalPage } from "../PendingApprovalPage";

describe("PendingApprovalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSession.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { approvalStatus: "pending" },
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    });
  });

  it("renders the pending approval copy for pending users", () => {
    render(<PendingApprovalPage />);

    expect(screen.getByText(/account pending approval/i)).toBeInTheDocument();
    expect(screen.getByText(/your account has been created and is pending approval/i)).toBeInTheDocument();
  });

  it("refreshes the session when checking status", async () => {
    const user = userEvent.setup();

    render(<PendingApprovalPage />);

    await user.click(screen.getByRole("button", { name: /check status/i }));

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it("redirects approved users to the dashboard route", async () => {
    mockUseAuth.mockReturnValue({
      user: { approvalStatus: "approved" },
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    });

    render(<PendingApprovalPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("redirects rejected users to the rejected page", async () => {
    mockUseAuth.mockReturnValue({
      user: { approvalStatus: "rejected" },
      refreshSession: mockRefreshSession,
      logout: mockLogout,
    });

    render(<PendingApprovalPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/account-rejected", { replace: true });
    });
  });
});
