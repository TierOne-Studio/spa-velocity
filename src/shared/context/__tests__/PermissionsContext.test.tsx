import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockUseAuth = vi.fn();
const mockGetMyPermissions = vi.fn();

vi.mock("@shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@features/Admin/services/rbacService", () => ({
  rbacService: {
    getMyPermissions: () => mockGetMyPermissions(),
  },
}));

import { PermissionsProvider, usePermissionsContext } from "../PermissionsContext";

const createWrapper = (children: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsProvider>{children}</PermissionsProvider>
    </QueryClientProvider>
  );
};

function TestConsumer({ resource, action }: { resource: string; action: string }) {
  const { permissions, can, isLoading } = usePermissionsContext();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="permissions">{permissions.join(",")}</div>
      <div data-testid="can">{String(can(resource, action))}</div>
    </div>
  );
}

function TestRefetch() {
  const { refetchPermissions } = usePermissionsContext();
  return <button onClick={refetchPermissions}>Refetch</button>;
}

describe("PermissionsContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when used outside PermissionsProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer resource="user" action="read" />);
    }).toThrow("usePermissionsContext must be used within a PermissionsProvider");

    consoleError.mockRestore();
  });

  it("provides empty permissions for unauthenticated user", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isAdminOrManager: false,
    });

    render(createWrapper(<TestConsumer resource="user" action="read" />));

    await waitFor(() => {
      expect(screen.getByTestId("permissions").textContent).toBe("");
    });
  });

  it("provides empty permissions for member (non-admin/manager)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", role: "member" },
      isAuthenticated: true,
      isAdminOrManager: false,
    });

    render(createWrapper(<TestConsumer resource="user" action="read" />));

    await waitFor(() => {
      expect(screen.getByTestId("permissions").textContent).toBe("");
    });
  });

  it("fetches and provides permissions for admin/manager", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1", role: "admin" },
      isAuthenticated: true,
      isAdminOrManager: true,
    });
    mockGetMyPermissions.mockResolvedValue(["user:read", "user:create", "organization:list"]);

    render(createWrapper(<TestConsumer resource="user" action="read" />));

    await waitFor(() => {
      expect(screen.getByTestId("permissions").textContent).toContain("user:read");
    });
  });

  it("can() returns true for granted permission", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1", role: "admin" },
      isAuthenticated: true,
      isAdminOrManager: true,
    });
    mockGetMyPermissions.mockResolvedValue(["user:read", "user:create"]);

    render(createWrapper(<TestConsumer resource="user" action="read" />));

    await waitFor(() => {
      expect(screen.getByTestId("can").textContent).toBe("true");
    });
  });

  it("can() returns false for missing permission", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "manager-1", role: "manager" },
      isAuthenticated: true,
      isAdminOrManager: true,
    });
    mockGetMyPermissions.mockResolvedValue(["user:read"]);

    render(createWrapper(<TestConsumer resource="user" action="delete" />));

    await waitFor(() => {
      expect(screen.getByTestId("can").textContent).toBe("false");
    });
  });

  it("refetchPermissions invalidates the permissions query cache", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1", role: "admin" },
      isAuthenticated: true,
      isAdminOrManager: true,
    });
    mockGetMyPermissions.mockResolvedValue(["user:read"]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <PermissionsProvider>
          <TestRefetch />
        </PermissionsProvider>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Refetch" }));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["rbac", "my-permissions"] }),
    );
  });

  it("can() returns false for unauthenticated user", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isAdminOrManager: false,
    });

    render(createWrapper(<TestConsumer resource="user" action="read" />));

    await waitFor(() => {
      expect(screen.getByTestId("can").textContent).toBe("false");
    });
  });
});
