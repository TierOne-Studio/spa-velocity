import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
  mockGetOrganizationRolesMetadata,
  mockListUsers,
  mockListMemberCandidates,
  mockUseAuth,
  mockUseEffectiveSession,
  mockCan,
  mockRefetchPermissions,
  mockSessionRefetch,
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
  mockGetOrganizationRolesMetadata: vi.fn(),
  mockListUsers: vi.fn(),
  mockListMemberCandidates: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseEffectiveSession: vi.fn(),
  mockCan: vi.fn(),
  mockRefetchPermissions: vi.fn(),
  mockSessionRefetch: vi.fn(),
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
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  Select: ({ children, disabled, value }: { children: ReactNode; disabled?: boolean; value?: string }) => (
    <div data-disabled={disabled ? "true" : "false"} data-select-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/shared/components/ui/card", () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock("@/shared/components/ui/skeleton", () => ({
  Skeleton: ({ ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

import { OrganizationsPage } from "./OrganizationsPage";

describe("OrganizationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org One", slug: "org-one", createdAt: new Date() }],
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
    mockCan.mockImplementation((resource: string, action: string) => resource === "organization" && action === "invite");
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
