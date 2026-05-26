import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const {
  mockUseOrganizations,
  mockUseOrganizationMembers,
  mockUseCreateOrganization,
  mockUseUpdateOrganization,
  mockUseDeleteOrganization,
  mockUseRemoveMember,
  mockUseUpdateMemberRole,
  mockUseAddMember,
  mockUseCheckSlug,
  mockUseSetActiveOrganization,
  mockUseAvailableCollections,
  mockGetOrganizationRolesMetadata,
  mockListUsers,
  mockListMemberCandidates,
  mockUseAuth,
  mockUseEffectiveSession,
  mockCan,
  mockRefetchPermissions,
  mockSessionRefetch,
  mockUseSqlConnections,
  mockUseCreateSqlConnection,
  mockUseUpdateSqlConnection,
  mockUseDeleteSqlConnection,
  mockUseTestSqlConnection,
  mockUseTestSqlConnectionCredentials,
  mockUseTestCreateOrganizationSqlConnectionCredentials,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => ({
  mockUseOrganizations: vi.fn(),
  mockUseOrganizationMembers: vi.fn(),
  mockUseCreateOrganization: vi.fn(),
  mockUseUpdateOrganization: vi.fn(),
  mockUseDeleteOrganization: vi.fn(),
  mockUseRemoveMember: vi.fn(),
  mockUseUpdateMemberRole: vi.fn(),
  mockUseAddMember: vi.fn(),
  mockUseCheckSlug: vi.fn(),
  mockUseSetActiveOrganization: vi.fn(),
  mockUseAvailableCollections: vi.fn(),
  mockGetOrganizationRolesMetadata: vi.fn(),
  mockListUsers: vi.fn(),
  mockListMemberCandidates: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseEffectiveSession: vi.fn(),
  mockCan: vi.fn(),
  mockRefetchPermissions: vi.fn(),
  mockSessionRefetch: vi.fn(),
  mockUseSqlConnections: vi.fn(),
  mockUseCreateSqlConnection: vi.fn(),
  mockUseUpdateSqlConnection: vi.fn(),
  mockUseDeleteSqlConnection: vi.fn(),
  mockUseTestSqlConnection: vi.fn(),
  mockUseTestSqlConnectionCredentials: vi.fn(),
  mockUseTestCreateOrganizationSqlConnectionCredentials: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("../hooks/useOrganizations", () => ({
  useOrganizations: (...args: unknown[]) => mockUseOrganizations(...args),
  useOrganizationMembers: (...args: unknown[]) => mockUseOrganizationMembers(...args),
  useCreateOrganization: () => mockUseCreateOrganization(),
  useUpdateOrganization: () => mockUseUpdateOrganization(),
  useDeleteOrganization: () => mockUseDeleteOrganization(),
  useRemoveMember: () => mockUseRemoveMember(),
  useUpdateMemberRole: () => mockUseUpdateMemberRole(),
  useAddMember: () => mockUseAddMember(),
  useCheckSlug: () => mockUseCheckSlug(),
  useSetActiveOrganization: () => mockUseSetActiveOrganization(),
}));

vi.mock("../hooks/useAirweaveCollections", () => ({
  useAirweaveCollections: (...args: unknown[]) => mockUseAvailableCollections(...args),
}));

vi.mock("../hooks/useSqlConnections", () => ({
  useSqlConnections: (...args: unknown[]) => mockUseSqlConnections(...args),
  useCreateSqlConnection: () => mockUseCreateSqlConnection(),
  useUpdateSqlConnection: () => mockUseUpdateSqlConnection(),
  useDeleteSqlConnection: () => mockUseDeleteSqlConnection(),
  useTestSqlConnection: () => mockUseTestSqlConnection(),
  useTestSqlConnectionCredentials: () => mockUseTestSqlConnectionCredentials(),
  useTestCreateOrganizationSqlConnectionCredentials: () =>
    mockUseTestCreateOrganizationSqlConnectionCredentials(),
}));

vi.mock("../services/adminService", () => ({
  adminService: {
    listUsers: mockListUsers,
  },
  organizationService: {
    listMemberCandidates: mockListMemberCandidates,
  },
  getOrganizationRolesMetadata: mockGetOrganizationRolesMetadata,
}));

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}));

// Derive `useOrgCapabilities` off the existing `useEffectiveSession` fixture so
// this component test doesn't need a QueryClientProvider for the real
// memberships fetch. Role + active org come straight from the session mock.
vi.mock("@/shared/hooks/useOrgCapabilities", () => ({
  useOrgCapabilities: () => {
    const session = mockUseEffectiveSession();
    const rawRole = session?.data?.user?.role;
    const isSuperadmin = Array.isArray(rawRole)
      ? rawRole.includes("superadmin")
      : String(rawRole ?? "")
          .split(",")
          .map((r: string) => r.trim())
          .filter(Boolean)
          .includes("superadmin");
    const activeOrganizationId =
      session?.data?.session?.activeOrganizationId ?? null;
    return {
      isSuperadmin,
      isMultiOrgMember: false,
      isSingleOrgMember: false,
      memberOrganizations: [],
      activeOrganizationId,
      isLoading: false,
    };
  },
}));

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => ({ can: mockCan, refetchPermissions: mockRefetchPermissions }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@tabler/icons-react", () => ({
  IconDotsVertical: () => <span aria-hidden="true">dots</span>,
  IconPlus: () => <span aria-hidden="true">plus</span>,
  IconTrash: () => <span aria-hidden="true">trash</span>,
  IconEdit: () => <span aria-hidden="true">edit</span>,
  IconUsers: () => <span aria-hidden="true">users</span>,
  IconPlayerPlay: () => <span aria-hidden="true">play</span>,
}));

vi.mock("@/shared/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("@/shared/components/ui/avatar", () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  AvatarImage: (props: HTMLAttributes<HTMLImageElement>) => <img alt="" {...props} />,
}));

vi.mock("@/shared/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children, onClick }: { children: ReactNode; onClick?: (e: React.MouseEvent) => void }) => <div onClick={onClick}>{children}</div>,
}));

vi.mock("@/shared/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => <>{open ? children : null}</>,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div role="dialog" {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock("@/shared/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/shared/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("@/shared/components/ui/select", () => ({
  Select: ({
    children,
    disabled,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    disabled?: boolean;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select
      data-disabled={disabled ? "true" : "false"}
      data-select-value={value}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option data-value={value} value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: HTMLAttributes<HTMLDivElement>) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("@/shared/components/ui/card", () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock("@/shared/components/ui/skeleton", () => ({
  Skeleton: ({ ...props }: HTMLAttributes<HTMLDivElement>) => <div data-slot="skeleton" {...props} />,
}));

import { OrganizationsPage } from "./OrganizationsPage";

describe("OrganizationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date(), metadata: { airweaveCollectionId: "collection-1", retained: "value" } }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseOrganizationMembers.mockReturnValue({
      data: [
        {
          id: "member-1",
          userId: "user-1",
          role: "member",
          user: { id: "user-1", name: "Existing User", email: "existing@example.com" },
        },
      ],
      isLoading: false,
    });
    mockUseSqlConnections.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseCreateSqlConnection.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateSqlConnection.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDeleteSqlConnection.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseTestSqlConnection.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseTestSqlConnectionCredentials.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseTestCreateOrganizationSqlConnectionCredentials.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseRemoveMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateMemberRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAddMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseCheckSlug.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAvailableCollections.mockReturnValue({
      data: [
        {
          id: "collection-1-id",
          name: "TierOne Collection",
          readableId: "collection-1",
          organizationId: "org-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          status: "ready",
          sourceConnectionCount: 2,
        },
        {
          id: "collection-2-id",
          name: "TierTwo Collection",
          readableId: "collection-2",
          organizationId: "org-2",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          status: "ready",
          sourceConnectionCount: 1,
        },
      ],
      isLoading: false,
      error: null,
    });
    mockGetOrganizationRolesMetadata.mockResolvedValue({
      roles: [
        { name: "member", displayName: "Member", description: null, color: null, isSystem: true },
        { name: "manager", displayName: "Manager", description: null, color: null, isSystem: true },
      ],
      assignableRoles: ["member", "manager"],
    });
    mockListUsers.mockResolvedValue({ data: [] });
    mockListMemberCandidates.mockResolvedValue([
      { id: "user-2", name: "Candidate User", email: "candidate@example.com", role: "member", image: null },
    ]);
    mockUseAuth.mockReturnValue({
      user: { id: "manager-1", role: "manager" },
    });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "manager-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
      refetch: mockSessionRefetch,
    });
    mockCan.mockImplementation((resource: string, action: string) =>
      (resource === "organization" && action === "invite") ||
      (resource === "airweave" && action === "read"),
    );
  });

  it("loads add-member candidates from organizationService instead of the global users list", async () => {
    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /org one/i }));
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockListMemberCandidates).toHaveBeenCalledWith("org-1", { limit: 100 });
    });

    expect(mockListUsers).not.toHaveBeenCalled();
    expect(await screen.findByText(/candidate user \(candidate@example.com\)/i)).toBeVisible();
  });

  it("does not render duplicate role options when metadata contains repeated role names", async () => {
    mockGetOrganizationRolesMetadata.mockResolvedValue({
      roles: [
        { name: "member", displayName: "Member", description: null, color: null, isSystem: true },
        { name: "member", displayName: "Member", description: null, color: null, isSystem: false },
        { name: "manager", displayName: "Manager", description: null, color: null, isSystem: true },
      ],
      assignableRoles: ["member", "member", "manager"],
    });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /org one/i }));
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    const dialog = await screen.findByRole("dialog");

    await waitFor(() => {
      expect(dialog.querySelectorAll('[data-value="member"]')).toHaveLength(1);
      expect(dialog.querySelectorAll('[data-value="manager"]')).toHaveLength(1);
    });
  });

  it("auto-switches the active organization when selecting a different organization to manage", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() },
          { id: "org-2", name: "Org Two", slug: "org-two", createdAt: new Date() },
        ],
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseOrganizationMembers.mockReturnValue({
      data: [
        {
          id: "member-1",
          userId: "user-1",
          role: "member",
          user: { id: "user-1", name: "Existing User", email: "existing@example.com" },
        },
        {
          id: "member-2",
          userId: "user-2",
          role: "manager",
          user: { id: "user-2", name: "Other User", email: "other@example.com" },
        },
      ],
      isLoading: false,
    });
    const setActive = vi.fn().mockResolvedValue(undefined)
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: setActive, isPending: false })

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /org two/i }));

    await waitFor(() => {
      expect(setActive).toHaveBeenCalledWith("org-2");
      expect(mockSessionRefetch).toHaveBeenCalled();
      expect(mockRefetchPermissions).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Switched organization");
      expect(screen.getByRole("button", { name: /add member/i })).toBeVisible();
      expect(
        screen.queryByText(/switch your active organization to manage members for this organization/i),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/existing user/i)).toBeVisible();
      expect(screen.getByText(/other user/i)).toBeVisible();
      expect(mockUseOrganizationMembers).toHaveBeenLastCalledWith("org-2");
    });
  });

  it("lets superadmin manage any organization and keeps the last admin role select enabled", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() },
          { id: "org-2", name: "Org Two", slug: "org-two", createdAt: new Date() },
        ],
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseOrganizationMembers.mockReturnValue({
      data: [
        {
          id: "member-1",
          userId: "user-1",
          role: "manager",
          user: { id: "user-1", name: "Manager User", email: "manager@example.com" },
        },
        {
          id: "member-2",
          userId: "user-2",
          role: "admin",
          user: { id: "user-2", name: "Admin User", email: "admin@example.com" },
        },
      ],
      isLoading: false,
    });
    mockUseAuth.mockReturnValue({
      user: { id: "super-1", role: "superadmin" },
    });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "super-1", role: "superadmin" },
        session: {},
      },
    });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /org two/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add member/i })).toBeVisible();
      expect(
        screen.queryByText(/switch your active organization to manage members for this organization/i),
      ).not.toBeInTheDocument();
      expect(mockUseOrganizationMembers).toHaveBeenLastCalledWith("org-2");
      expect(screen.queryAllByText("Admin").some((node) => node.closest('[data-disabled="false"]'))).toBe(true);
    });
  });
});

describe("OrganizationsPage – CRUD and member operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date(), metadata: { airweaveCollectionId: "collection-1", retained: "value" } }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseOrganizationMembers.mockReturnValue({
      data: [
        {
          id: "member-1",
          userId: "user-1",
          role: "member",
          user: { id: "user-1", name: "Existing User", email: "existing@example.com" },
        },
      ],
      isLoading: false,
    });
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseRemoveMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateMemberRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAddMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseCheckSlug.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAvailableCollections.mockReturnValue({
      data: [
        {
          id: "collection-1-id",
          name: "TierOne Collection",
          readableId: "collection-1",
          organizationId: "org-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          status: "ready",
          sourceConnectionCount: 2,
        },
        {
          id: "collection-2-id",
          name: "TierTwo Collection",
          readableId: "collection-2",
          organizationId: "org-2",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          status: "ready",
          sourceConnectionCount: 1,
        },
      ],
      isLoading: false,
      error: null,
    })
    mockGetOrganizationRolesMetadata.mockResolvedValue({
      roles: [
        { name: "member", displayName: "Member", description: null, color: null, isSystem: true },
        { name: "manager", displayName: "Manager", description: null, color: null, isSystem: true },
      ],
      assignableRoles: ["member", "manager"],
    });
    mockListMemberCandidates.mockResolvedValue([
      { id: "user-2", name: "Candidate User", email: "candidate@example.com", role: "member", image: null },
    ]);
    mockListUsers.mockResolvedValue({ data: [] });
    mockUseAuth.mockReturnValue({ user: { id: "mgr-1", role: "manager" } });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "mgr-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
      refetch: mockSessionRefetch,
    });
    // grant all org permissions by default for these tests
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "organization" || (resource === "airweave" && action === "read"),
    );
  });

  it("shows loading skeletons when organizations are loading", () => {
    mockUseOrganizations.mockReturnValue({ data: undefined, isLoading: true });
    mockGetOrganizationRolesMetadata.mockImplementation(() => new Promise(() => {}));
    render(<OrganizationsPage />);
    // Skeleton elements should be in the DOM
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("creates an organization successfully", async () => {
    const createMutate = vi.fn().mockResolvedValue({ id: "org-new" });
    const setActiveMutate = vi.fn().mockResolvedValue(undefined)
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false });
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: setActiveMutate, isPending: false })

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "New Org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Org" }),
      );
      expect(setActiveMutate).toHaveBeenCalledWith("org-new")
      expect(mockSessionRefetch).toHaveBeenCalled()
      expect(mockRefetchPermissions).toHaveBeenCalled()
      expect(mockToastSuccess).toHaveBeenCalledWith("Organization created successfully");
    });
  });

  it("persists an empty Airweave allowlist when creating an organization without selections", async () => {
    const createMutate = vi.fn().mockResolvedValue({ id: "org-new" })
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false })

    render(<OrganizationsPage />)

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }))
    const dialog = await screen.findByRole("dialog")

    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "TierOne" } })
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "TierOne",
          metadata: { allowedAirweaveCollectionIds: [] },
        }),
      )
    })
  })

  it("shows a partial-success error when org creation succeeds but active-org switching fails", async () => {
    const createMutate = vi.fn().mockResolvedValue({ id: "org-new", name: "New Org", slug: "new-org" })
    const setActiveMutate = vi.fn().mockRejectedValue(new Error("Switch failed"))
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false })
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: setActiveMutate, isPending: false })

    render(<OrganizationsPage />)

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }))
    const dialog = await screen.findByRole("dialog")

    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "New Org" } })
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalled()
      expect(setActiveMutate).toHaveBeenCalledWith("org-new")
      expect(mockToastError).toHaveBeenCalledWith(
        "Organization created but failed to switch active organization: Switch failed",
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("Organization created successfully")
    })
  })

  it("shows generic error when setActive throws a non-Error (covers line 324 else branch)", async () => {
    const createMutate = vi.fn().mockResolvedValue({ id: "org-new2", name: "New Org 2", slug: "new-org-2", createdAt: new Date().toISOString() })
    // Throw a non-Error string to hit the else branch at line 324
    const setActiveMutate = vi.fn().mockRejectedValue("string-error")
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false })
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: setActiveMutate, isPending: false })

    render(<OrganizationsPage />)

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "New Org 2" } })
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Organization created but failed to switch active organization",
      )
    })
  })

  it("shows generic error when creating an organization fails with non-Error (covers line 333 else branch)", async () => {
    // Throw a non-Error value to hit the else branch at line 333
    const createMutate = vi.fn().mockRejectedValue("non-error-string")
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false })

    render(<OrganizationsPage />)
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "Bad Org 2" } })
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to create organization")
    })
  })

  it("shows error toast when creating an organization fails", async () => {
    const createMutate = vi.fn().mockRejectedValue(new Error("Create failed"));
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "Bad Org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Create failed");
    });
  });

  it("opens the edit dialog and saves changes successfully", async () => {
    const updateMutate = vi.fn().mockResolvedValue({});
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: updateMutate, isPending: false });

    render(<OrganizationsPage />);

    // The DropdownMenuItem for "Edit" renders as a div with direct text "Edit"
    const editMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" && content.trim() === "Edit" && el.querySelector("span") !== null,
    );
    fireEvent.click(editMenuItem);

    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByDisplayValue("Org One");
    fireEvent.change(nameInput, { target: { value: "Org One Updated" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          data: expect.objectContaining({ name: "Org One Updated" }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Organization updated successfully");
    });
  });

  it("preserves existing metadata and migrates the legacy collection to the allowlist on save", async () => {
    const updateMutate = vi.fn().mockResolvedValue({})
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: updateMutate, isPending: false })

    render(<OrganizationsPage />)

    const editMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" && content.trim() === "Edit" && el.querySelector("span") !== null,
    )
    fireEvent.click(editMenuItem)

    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              retained: "value",
              allowedAirweaveCollectionIds: ["collection-1"],
            }),
          }),
        }),
      )
    })
  })

  it("shows error toast when updating an organization fails", async () => {
    const updateMutate = vi.fn().mockRejectedValue(new Error("Update failed"));
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: updateMutate, isPending: false });

    render(<OrganizationsPage />);

    const editMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" && content.trim() === "Edit" && el.querySelector("span") !== null,
    );
    fireEvent.click(editMenuItem);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Update failed");
    });
  });

  it("opens the delete dialog and deletes the organization successfully", async () => {
    const deleteMutate = vi.fn().mockResolvedValue({});
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });

    render(<OrganizationsPage />);

    // The Delete DropdownMenuItem has class "text-destructive"
    const deleteMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" &&
      el?.classList?.contains("text-destructive") &&
      /Delete/.test(content),
    );
    fireEvent.click(deleteMenuItem);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith("org-1");
      expect(mockToastSuccess).toHaveBeenCalledWith("Organization deleted successfully");
    });
  });

  it("shows error toast when deleting an organization fails", async () => {
    const deleteMutate = vi.fn().mockRejectedValue(new Error("Delete failed"));
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });

    render(<OrganizationsPage />);

    const deleteMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" &&
      el?.classList?.contains("text-destructive") &&
      /Delete/.test(content),
    );
    fireEvent.click(deleteMenuItem);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("shows error toast when loading member candidates fails", async () => {
    mockListMemberCandidates.mockRejectedValue(new Error("Load failed"));

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add member/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to load users");
    });
  });

  it("adds a member successfully", async () => {
    const addMutate = vi.fn().mockResolvedValue({});
    mockUseAddMember.mockReturnValue({ mutateAsync: addMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add member/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    const dialog = await screen.findByRole("dialog");

    // Wait for candidates to load, then select a user
    await waitFor(() => expect(mockListMemberCandidates).toHaveBeenCalled());

    const selects = within(dialog).getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "user-2" } }); // User select

    fireEvent.click(within(dialog).getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(addMutate).toHaveBeenCalledWith({
        organizationId: "org-1",
        userId: "user-2",
        role: "member",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Member added successfully");
    });
  });

  it("shows error toast when adding a member fails", async () => {
    const addMutate = vi.fn().mockRejectedValue(new Error("Add failed"));
    mockUseAddMember.mockReturnValue({ mutateAsync: addMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /add member/i })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(mockListMemberCandidates).toHaveBeenCalled());

    const selects = within(dialog).getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "user-2" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Add failed");
    });
  });

  it("removes a member successfully", async () => {
    const removeMutate = vi.fn().mockResolvedValue({});
    mockUseRemoveMember.mockReturnValue({ mutateAsync: removeMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => expect(screen.getByText("Existing User")).toBeVisible());

    // The remove member button is the button with class text-destructive (inside member table)
    const removeBtn = screen.getAllByRole("button").find((btn) =>
      btn.classList.contains("text-destructive"),
    )!;
    fireEvent.click(removeBtn);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^remove member$/i }));

    await waitFor(() => {
      expect(removeMutate).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-1",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Member removed successfully");
    });
  });

  it("shows error toast when removing a member fails", async () => {
    const removeMutate = vi.fn().mockRejectedValue(new Error("Remove failed"));
    mockUseRemoveMember.mockReturnValue({ mutateAsync: removeMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));
    await waitFor(() => expect(screen.getByText("Existing User")).toBeVisible());

    const removeBtn = screen.getAllByRole("button").find((btn) =>
      btn.classList.contains("text-destructive"),
    )!;
    fireEvent.click(removeBtn);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^remove member$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Remove failed");
    });
  });

  it("updates a member role successfully via select change", async () => {
    const updateRoleMutate = vi.fn().mockResolvedValue({});
    mockUseUpdateMemberRole.mockReturnValue({ mutateAsync: updateRoleMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));
    await waitFor(() => expect(screen.getByText("Existing User")).toBeVisible());

    // Wait for role options to be populated before attempting the change
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Manager" })).toBeInTheDocument();
    });

    const membersTable = screen.getByRole("table")
    const roleSelect = within(membersTable).getByRole("combobox");
    fireEvent.change(roleSelect, { target: { value: "manager" } });

    await waitFor(() => {
      expect(updateRoleMutate).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-1",
        role: "manager",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Role updated successfully");
    });
  });

  it("shows error toast when updating a member role fails", async () => {
    const updateRoleMutate = vi.fn().mockRejectedValue(new Error("Role update failed"));
    mockUseUpdateMemberRole.mockReturnValue({ mutateAsync: updateRoleMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));
    await waitFor(() => expect(screen.getByText("Existing User")).toBeVisible());

    const membersTable = screen.getByRole("table")
    const roleSelect = within(membersTable).getByRole("combobox");
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Manager" })).toBeInTheDocument();
    });
    fireEvent.change(roleSelect, { target: { value: "manager" } });

    await waitFor(() => {
      expect(updateRoleMutate).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-1",
        role: "manager",
      });
      expect(mockToastError).toHaveBeenCalledWith("Role update failed");
    });
  });

  it("shows error toast when switching the active organization fails", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() },
          { id: "org-2", name: "Org Two", slug: "org-two", createdAt: new Date() },
        ],
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
    });
    const setActive = vi.fn().mockRejectedValue(new Error("Switch failed"));
    mockUseSetActiveOrganization.mockReturnValue({ mutateAsync: setActive, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org two/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Switch failed");
    });
  });

  it("cancels the delete dialog without deleting", async () => {
    const deleteMutate = vi.fn();
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });

    render(<OrganizationsPage />);

    const deleteMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" &&
      el?.classList?.contains("text-destructive") &&
      /Delete/.test(content),
    );
    fireEvent.click(deleteMenuItem);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("cancels the add member dialog without adding", async () => {
    const addMutate = vi.fn();
    mockUseAddMember.mockReturnValue({ mutateAsync: addMutate, isPending: false });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    const addBtn = await screen.findByRole("button", { name: /add member/i });
    fireEvent.click(addBtn);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("cancels the remove member dialog without removing", async () => {
    const removeMutate = vi.fn();
    mockUseRemoveMember.mockReturnValue({ mutateAsync: removeMutate, isPending: false });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /org one/i }));
    await waitFor(() => expect(screen.getByText("Existing User")).toBeVisible());

    const removeBtn = screen.getAllByRole("button").find((btn) =>
      btn.classList.contains("text-destructive"),
    )!;
    fireEvent.click(removeBtn);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(removeMutate).not.toHaveBeenCalled();
  });

  it("renders pagination and navigates pages when totalPages > 1", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() }],
        total: 15,
        totalPages: 2,
      },
      isLoading: false,
    });

    render(<OrganizationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
    });

    const prevBtn = screen.getByRole("button", { name: /previous/i });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    });
  });

  it("shows selected org details panel with allowlist chips", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{
          id: "org-1",
          name: "Org One",
          slug: "org-one",
          createdAt: new Date(),
          metadata: { allowedAirweaveCollectionIds: ["collection-1"] },
        }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseAvailableCollections.mockReturnValue({
      data: [{
        id: "col-id",
        name: "My Collection",
        readableId: "collection-1",
        organizationId: "org-1",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        status: "ready",
        sourceConnectionCount: 1,
      }],
      isLoading: false,
      error: null,
    });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => {
      expect(screen.getByText("Airweave collections allowlist")).toBeInTheDocument();
      expect(screen.getByText("My Collection")).toBeInTheDocument();
      expect(screen.getByText("collection-1")).toBeInTheDocument();
    });
  });

  it("shows collectionId text when collection ID is set but collection is not found", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{
          id: "org-1",
          name: "Org One",
          slug: "org-one",
          createdAt: new Date(),
          metadata: { airweaveCollectionId: "unknown-collection" },
        }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseAvailableCollections.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => {
      // When collectionId is set but collection not found: shows collectionId as fallback (appears in 2 divs)
      const matches = screen.getAllByText("unknown-collection");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows empty allowlist message when org has no allowed collections", async () => {
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{
          id: "org-1",
          name: "Org One",
          slug: "org-one",
          createdAt: new Date(),
          metadata: {},
        }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no collections allowed/i),
      ).toBeInTheDocument();
    });
  });

  it("shows members loading skeletons when membersLoading is true", async () => {
    mockUseOrganizationMembers.mockReturnValue({ data: [], isLoading: true });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => {
      // In the member loading state, skeleton elements appear in the detail panel
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("updates search field when typing in search input", async () => {
    render(<OrganizationsPage />);

    const searchInput = screen.getByPlaceholderText(/search organizations/i);
    fireEvent.change(searchInput, { target: { value: "tier" } });

    // The value should update and page should reset to 1
    expect(searchInput).toHaveValue("tier");
  });

  it("selects an org via keyboard Enter key", async () => {
    render(<OrganizationsPage />);

    const orgButton = screen.getByRole("button", { name: /org one/i });
    fireEvent.keyDown(orgButton, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Manage members")).toBeInTheDocument();
    });
  });

  it("selects an org via keyboard Space key", async () => {
    render(<OrganizationsPage />);

    const orgButton = screen.getByRole("button", { name: /org one/i });
    fireEvent.keyDown(orgButton, { key: " " });

    await waitFor(() => {
      expect(screen.getByText("Manage members")).toBeInTheDocument();
    });
  });

  it("does not select org via keyboard for unhandled keys", async () => {
    render(<OrganizationsPage />);

    const orgButton = screen.getByRole("button", { name: /org one/i });
    fireEvent.keyDown(orgButton, { key: "Tab" });

    // Organization details should NOT be shown (org not selected)
    expect(screen.queryByText("Manage members")).not.toBeInTheDocument();
  });

  it("changes role in add member dialog", async () => {
    const addMutate = vi.fn().mockResolvedValue({});
    mockUseAddMember.mockReturnValue({ mutateAsync: addMutate, isPending: false });

    render(<OrganizationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /org one/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /add member/i })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(mockListMemberCandidates).toHaveBeenCalled());

    const selects = within(dialog).getAllByRole("combobox");
    // Second select is the role select
    fireEvent.change(selects[1], { target: { value: "manager" } });
    // Select user to enable submit
    fireEvent.change(selects[0], { target: { value: "user-2" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(addMutate).toHaveBeenCalledWith(expect.objectContaining({ role: "manager" }));
    });
  });
});

  it("opens the edit dialog and cancels without saving", async () => {
    const updateMutate = vi.fn();
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: updateMutate, isPending: false });
    mockCan.mockImplementation((resource: string) =>
      resource === "organization",
    );

    render(<OrganizationsPage />);

    const editMenuItem = screen.getByText((content, el) =>
      el?.tagName === "DIV" && content.trim() === "Edit" && el.querySelector("span") !== null,
    );
    fireEvent.click(editMenuItem);

    const dialog = await screen.findByRole("dialog");
    // Change the slug field to cover the onChange handler for slug
    const slugInput = within(dialog).getByDisplayValue("org-one");
    fireEvent.change(slugInput, { target: { value: "org-one-updated" } });

    // Cancel instead of saving
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("shows slug status as available when checkSlug returns true", async () => {
    const checkSlugMutate = vi.fn().mockResolvedValue({ status: true });
    mockUseCheckSlug.mockReturnValue({ mutateAsync: checkSlugMutate, isPending: false });
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "organization" && action === "create",
    );

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    const slugInput = within(dialog).getByPlaceholderText(/my-organization/i);
    fireEvent.change(slugInput, { target: { value: "good-slug" } });

    await waitFor(() => {
      expect(checkSlugMutate).toHaveBeenCalledWith("good-slug");
    });

    await waitFor(() => {
      expect(within(dialog).getByText(/✓ available/i)).toBeInTheDocument();
    });
  });

  it("shows slug status as taken when checkSlug returns false", async () => {
    const checkSlugMutate = vi.fn().mockResolvedValue({ status: false });
    mockUseCheckSlug.mockReturnValue({ mutateAsync: checkSlugMutate, isPending: false });
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "organization" && action === "create",
    );

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    const slugInput = within(dialog).getByPlaceholderText(/my-organization/i);
    fireEvent.change(slugInput, { target: { value: "taken-slug" } });

    await waitFor(() => {
      expect(checkSlugMutate).toHaveBeenCalledWith("taken-slug");
    });

    await waitFor(() => {
      expect(within(dialog).getByText(/✗ taken/i)).toBeInTheDocument();
    });
  });

  it("clicking the dots trigger button fires stopPropagation (covers line 526 onClick)", () => {
    // The DropdownMenuTrigger mock now passes onClick to the wrapper div
    // Clicking the button inside it bubbles up and fires onClick={(e) => e.stopPropagation()}
    render(<OrganizationsPage />)
    // The dots trigger renders as <button>dots</button> wrapped in the div with onClick
    const dotsButton = screen.getByText("dots").closest("button") as HTMLButtonElement
    expect(dotsButton).not.toBeNull()
    // Click it — the onClick handler (stopPropagation) should fire without errors
    fireEvent.click(dotsButton)
    expect(screen.getByText("Org One")).toBeInTheDocument()
  })

  it("cancels the create organization dialog without creating", async () => {
    const createMutate = vi.fn();
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false });
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "organization" && action === "create",
    );

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    // Also type in the name field to cover that onChange
    const nameInput = within(dialog).getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "My New Org" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("renders without crashing when orgsResponse is undefined (covers ?? fallback branches)", () => {
    // data: undefined — covers orgsResponse?.data ?? [], totalPages ?? 1, total ?? 0
    mockUseOrganizations.mockReturnValue({ data: undefined, isLoading: false });
    render(<OrganizationsPage />);
    // Should render without crash (shows empty state)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates tested SQL connection drafts after organization creation", async () => {
    const createOrganizationMutate = vi.fn().mockResolvedValue({
      id: "org-new",
      name: "New Org",
      slug: "new-org",
      createdAt: "2026-04-22T00:00:00.000Z",
      metadata: undefined,
    });
    const setActiveOrganizationMutate = vi.fn().mockResolvedValue(undefined);
    const createSqlConnectionMutate = vi.fn().mockResolvedValue({ id: "conn-1" });
    const testDraftConnectionMutate = vi.fn().mockResolvedValue({ ok: true });
    const checkSlugMutate = vi.fn().mockResolvedValue({ status: true });

    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseOrganizationMembers.mockReturnValue({ data: [], isLoading: false });
    mockUseSqlConnections.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseAvailableCollections.mockReturnValue({ data: [], isLoading: false, error: null });
    mockGetOrganizationRolesMetadata.mockResolvedValue({
      roles: [],
      assignableRoles: [],
    });
    mockUseAuth.mockReturnValue({ user: { id: "mgr-1", role: "manager" } });
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "organization" || (resource === "airweave" && action === "read"),
    );
    mockUseCreateOrganization.mockReturnValue({
      mutateAsync: createOrganizationMutate,
      isPending: false,
    });
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseRemoveMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateMemberRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAddMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseCheckSlug.mockReturnValue({ mutateAsync: checkSlugMutate, isPending: false });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "mgr-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
      refetch: mockSessionRefetch,
    });
    mockUseSetActiveOrganization.mockReturnValue({
      mutateAsync: setActiveOrganizationMutate,
      isPending: false,
    });
    mockUseCreateSqlConnection.mockReturnValue({
      mutateAsync: createSqlConnectionMutate,
      isPending: false,
    });
    mockUseTestCreateOrganizationSqlConnectionCredentials.mockReturnValue({
      mutateAsync: testDraftConnectionMutate,
      isPending: false,
    });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^name$/i), {
      target: { value: "New Org" },
    });
    fireEvent.change(within(dialog).getByLabelText(/slug/i), {
      target: { value: "new-org" },
    });

    await waitFor(() => {
      expect(checkSlugMutate).toHaveBeenCalledWith("new-org")
    })

    fireEvent.click(within(dialog).getByTestId("org-sql-draft-add"));
    const sqlDialog = await screen.findByTestId("sql-connection-form-dialog");

    fireEvent.change(within(sqlDialog).getByLabelText(/^name$/i), {
      target: { value: "Reporting DB" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/host/i), {
      target: { value: "db.example.com" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/port/i), {
      target: { value: "5432" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/^database/i), {
      target: { value: "reporting" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/^username/i), {
      target: { value: "reader" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/password/i), {
      target: { value: "typed-secret" },
    });

    fireEvent.click(within(sqlDialog).getByTestId("sql-conn-test"));

    await waitFor(() => {
      expect(testDraftConnectionMutate).toHaveBeenCalledWith({
        host: "db.example.com",
        port: 5432,
        database: "reporting",
        username: "reader",
        password: "typed-secret",
        ssl: false,
      });
    });

    fireEvent.click(within(sqlDialog).getByTestId("sql-conn-submit"));

    await waitFor(() => {
      expect(screen.queryByTestId("sql-connection-form-dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createOrganizationMutate).toHaveBeenCalledWith({
        name: "New Org",
        slug: "new-org",
        metadata: { allowedAirweaveCollectionIds: [] },
      });
    });

    await waitFor(() => {
      expect(createSqlConnectionMutate).toHaveBeenCalledWith({
        organizationId: "org-new",
        name: "Reporting DB",
        host: "db.example.com",
        port: 5432,
        database: "reporting",
        username: "reader",
        password: "typed-secret",
        ssl: false,
        schemaName: "public",
      });
    });
  });

  it("retries remaining SQL connection drafts without recreating the organization", async () => {
    const createOrganizationMutate = vi.fn().mockResolvedValue({
      id: "org-new",
      name: "New Org",
      slug: "new-org",
      createdAt: "2026-04-22T00:00:00.000Z",
      metadata: undefined,
    });
    const setActiveOrganizationMutate = vi.fn().mockResolvedValue(undefined);
    const createSqlConnectionMutate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Database unavailable"))
      .mockResolvedValueOnce({ id: "conn-1" });
    const testDraftConnectionMutate = vi.fn().mockResolvedValue({ ok: true });
    const checkSlugMutate = vi.fn().mockResolvedValue({ status: true });

    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() }],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    mockUseOrganizationMembers.mockReturnValue({ data: [], isLoading: false });
    mockUseSqlConnections.mockReturnValue({ data: [], isLoading: false, error: null });
    mockUseAvailableCollections.mockReturnValue({ data: [], isLoading: false, error: null });
    mockGetOrganizationRolesMetadata.mockResolvedValue({ roles: [], assignableRoles: [] });
    mockUseAuth.mockReturnValue({ user: { id: "mgr-1", role: "manager" } });
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "organization" || (resource === "airweave" && action === "read"),
    );
    mockUseCreateOrganization.mockReturnValue({
      mutateAsync: createOrganizationMutate,
      isPending: false,
    });
    mockUseUpdateOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDeleteOrganization.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseRemoveMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseUpdateMemberRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseAddMember.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseCheckSlug.mockReturnValue({ mutateAsync: checkSlugMutate, isPending: false });
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "mgr-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
      refetch: mockSessionRefetch,
    });
    mockUseSetActiveOrganization.mockReturnValue({
      mutateAsync: setActiveOrganizationMutate,
      isPending: false,
    });
    mockUseCreateSqlConnection.mockReturnValue({
      mutateAsync: createSqlConnectionMutate,
      isPending: false,
    });
    mockUseTestCreateOrganizationSqlConnectionCredentials.mockReturnValue({
      mutateAsync: testDraftConnectionMutate,
      isPending: false,
    });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^name$/i), {
      target: { value: "New Org" },
    });
    fireEvent.change(within(dialog).getByLabelText(/slug/i), {
      target: { value: "new-org" },
    });

    await waitFor(() => {
      expect(checkSlugMutate).toHaveBeenCalledWith("new-org")
    })

    fireEvent.click(within(dialog).getByTestId("org-sql-draft-add"));
    const sqlDialog = await screen.findByTestId("sql-connection-form-dialog");

    fireEvent.change(within(sqlDialog).getByLabelText(/^name$/i), {
      target: { value: "Reporting DB" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/host/i), {
      target: { value: "db.example.com" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/port/i), {
      target: { value: "5432" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/^database/i), {
      target: { value: "reporting" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/^username/i), {
      target: { value: "reader" },
    });
    fireEvent.change(within(sqlDialog).getByLabelText(/password/i), {
      target: { value: "typed-secret" },
    });

    fireEvent.click(within(sqlDialog).getByTestId("sql-conn-test"));

    await waitFor(() => {
      expect(testDraftConnectionMutate).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(within(sqlDialog).getByTestId("sql-conn-submit"));

    await waitFor(() => {
      expect(screen.queryByTestId("sql-connection-form-dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createOrganizationMutate).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(createSqlConnectionMutate).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Organization created, but failed to save SQL connection"),
      )
    })

    expect(within(dialog).getByTestId("org-sql-draft-retry-hint")).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: /retry sql connections/i }))

    await waitFor(() => {
      expect(createOrganizationMutate).toHaveBeenCalledTimes(1)
      expect(createSqlConnectionMutate).toHaveBeenCalledTimes(2)
    })

    expect(mockToastSuccess).toHaveBeenCalledWith("SQL connections saved successfully")
  });
