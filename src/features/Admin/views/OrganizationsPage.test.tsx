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
  SelectTrigger: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => null,
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

describe("OrganizationsPage – CRUD and member operations", () => {
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
      resource === "organization",
    );
  });

  it("shows loading skeletons when organizations are loading", () => {
    mockUseOrganizations.mockReturnValue({ data: undefined, isLoading: true });
    render(<OrganizationsPage />);
    // Skeleton elements should be in the DOM
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("creates an organization successfully", async () => {
    const createMutate = vi.fn().mockResolvedValue({ id: "org-new" });
    mockUseCreateOrganization.mockReturnValue({ mutateAsync: createMutate, isPending: false });

    render(<OrganizationsPage />);

    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "New Org" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Org" }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Organization created successfully");
    });
  });

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

    // The role select is the only combobox in the members section
    const roleSelect = screen.getByRole("combobox");
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

    const roleSelect = screen.getByRole("combobox");
    fireEvent.change(roleSelect, { target: { value: "manager" } });

    await waitFor(() => {
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
});
