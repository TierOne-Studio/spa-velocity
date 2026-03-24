import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const {
  mockUseUsers,
  mockUseUserCapabilitiesBatch,
  mockUseCreateUser,
  mockUseUpdateUser,
  mockUseBanUser,
  mockUseUnbanUser,
  mockUseSetUserRole,
  mockUseSetUserPassword,
  mockUseRemoveUser,
  mockUseRemoveUsers,
  mockUseImpersonateUser,
  mockUseOrganizations,
  mockUseAuth,
  mockUseEffectiveSession,
  mockCan,
  mockGetCreateUserMetadata,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseUsers: vi.fn(),
  mockUseUserCapabilitiesBatch: vi.fn(),
  mockUseCreateUser: vi.fn(),
  mockUseUpdateUser: vi.fn(),
  mockUseBanUser: vi.fn(),
  mockUseUnbanUser: vi.fn(),
  mockUseSetUserRole: vi.fn(),
  mockUseSetUserPassword: vi.fn(),
  mockUseRemoveUser: vi.fn(),
  mockUseRemoveUsers: vi.fn(),
  mockUseImpersonateUser: vi.fn(),
  mockUseOrganizations: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseEffectiveSession: vi.fn(),
  mockCan: vi.fn(),
  mockGetCreateUserMetadata: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock("../hooks/useUsers", () => ({
  useUsers: (...args: unknown[]) => mockUseUsers(...args),
  useUserCapabilitiesBatch: (...args: unknown[]) => mockUseUserCapabilitiesBatch(...args),
  useCreateUser: () => mockUseCreateUser(),
  useUpdateUser: () => mockUseUpdateUser(),
  useBanUser: () => mockUseBanUser(),
  useUnbanUser: () => mockUseUnbanUser(),
  useSetUserRole: () => mockUseSetUserRole(),
  useSetUserPassword: () => mockUseSetUserPassword(),
  useRemoveUser: () => mockUseRemoveUser(),
  useRemoveUsers: () => mockUseRemoveUsers(),
  useImpersonateUser: () => mockUseImpersonateUser(),
}))

vi.mock("../hooks/useOrganizations", () => ({
  useOrganizations: (...args: unknown[]) => mockUseOrganizations(...args),
}))

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}))

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => ({ can: mockCan }),
}))

vi.mock("../services/adminService", () => ({
  adminService: {
    getCreateUserMetadata: (...args: unknown[]) => mockGetCreateUserMetadata(...args),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock("@tabler/icons-react", () => ({
  IconDotsVertical: () => <span aria-hidden="true">dots</span>,
  IconBan: () => <span aria-hidden="true">ban</span>,
  IconCheck: () => <span aria-hidden="true">check</span>,
  IconKey: () => <span aria-hidden="true">key</span>,
  IconShield: () => <span aria-hidden="true">shield</span>,
  IconTrash: () => <span aria-hidden="true">trash</span>,
  IconUserScan: () => <span aria-hidden="true">scan</span>,
  IconPlus: () => <span aria-hidden="true">plus</span>,
  IconEdit: () => <span aria-hidden="true">edit</span>,
}))

vi.mock("@/shared/components/ui/server-data-table", () => ({
  ServerDataTable: ({
    toolbar,
    columns,
    data,
  }: {
    toolbar?: ReactNode
    columns?: Array<{
      accessorKey?: string
      header?: ReactNode | ((context: {
        table: {
          getIsAllPageRowsSelected: () => boolean
          getIsSomePageRowsSelected: () => boolean
          toggleAllPageRowsSelected: (value: boolean) => void
        }
      }) => ReactNode)
      id?: string
      cell?: (context: {
        row: {
          original: Record<string, unknown>
          getIsSelected: () => boolean
          toggleSelected: (value: boolean) => void
        }
      }) => ReactNode
    }>
    data?: Array<Record<string, unknown>>
  }) => {
    const table = {
      getIsAllPageRowsSelected: () => false,
      getIsSomePageRowsSelected: () => false,
      toggleAllPageRowsSelected: () => undefined,
    }

    return (
      <div>
        {toolbar}
        <div>
          {(columns ?? []).map((column, columnIndex) => {
            const key = String(column.id ?? column.accessorKey ?? columnIndex)
            if (typeof column.header === "function") {
              return <div key={key}>{column.header({ table })}</div>
            }
            return <div key={key}>{column.header ?? null}</div>
          })}
        </div>
        {(data ?? []).map((row) => (
          <div key={String(row.id)}>
            {(columns ?? []).map((column, columnIndex) => {
              const key = String(column.id ?? column.accessorKey ?? columnIndex)
              if (typeof column.cell === "function") {
                return (
                  <div key={key}>
                    {column.cell({
                      row: {
                        original: row,
                        getIsSelected: () => false,
                        toggleSelected: () => undefined,
                      },
                    })}
                  </div>
                )
              }

              if (column.accessorKey) {
                return <div key={key}>{String(row[column.accessorKey] ?? "")}</div>
              }

              return null
            })}
          </div>
        ))}
      </div>
    )
  },
}))

vi.mock("@/shared/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock("@/shared/components/ui/badge", () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))

vi.mock("@/shared/components/ui/avatar", () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  AvatarImage: (props: HTMLAttributes<HTMLImageElement>) => <img alt="" {...props} />,
}))

vi.mock("@/shared/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/shared/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => <>{open ? children : null}</>,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div role="dialog" {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}))

vi.mock("@/shared/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/shared/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}))

vi.mock("@/shared/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
    "aria-label"?: string
  }) => (
    <select
      aria-label={ariaLabel ?? "select"}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}))

vi.mock("@/shared/components/ui/checkbox", () => ({
  Checkbox: (props: InputHTMLAttributes<HTMLInputElement>) => <input type="checkbox" {...props} />,
}))

import { UsersPage } from "./UsersPage"

describe("UsersPage", () => {
  const createUserMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseUsers.mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({ data: {} })
    mockUseCreateUser.mockReturnValue(createUserMutation)
    mockUseUpdateUser.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseBanUser.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseUnbanUser.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseSetUserRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseSetUserPassword.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseRemoveUser.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseRemoveUsers.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseImpersonateUser.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseOrganizations.mockReturnValue({ data: { data: [] }, isLoading: false })

    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "admin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "admin" },
        session: { activeOrganizationId: "org-1" },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) => resource === "user" && action === "create")
    mockGetCreateUserMetadata.mockResolvedValue({
      roles: [{ name: "admin", displayName: "Admin" }],
      allowedRoleNames: ["admin"],
      organizations: [{ id: "org-1", name: "Org 1", slug: "org-1" }],
    })
    createUserMutation.mutateAsync.mockResolvedValue({ id: "user-1" })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("keeps organization required and submits organizationId when metadata defaults to admin", async () => {
    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /add user/i }))

    await waitFor(() => {
      expect(mockGetCreateUserMetadata).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/organization/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Alice Admin" } })
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "alice@example.com" } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "SecurePass123!" } })

    fireEvent.click(screen.getByRole("button", { name: /create user/i }))

    await waitFor(() => {
      expect(createUserMutation.mutateAsync).toHaveBeenCalledWith({
        name: "Alice Admin",
        email: "alice@example.com",
        password: "SecurePass123!",
        role: "admin",
        organizationId: "org-1",
      })
    })
  })

  it("impersonates a superadmin-selected user without requiring a manual organization selector", async () => {
    const impersonateMutation = vi.fn().mockResolvedValue(undefined)

    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Target User",
            email: "target@example.com",
            role: "manager",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: false,
            ban: false,
            unban: false,
            setPassword: false,
            remove: false,
            revokeSessions: false,
            impersonate: true,
          },
        },
      },
    })
    mockUseImpersonateUser.mockReturnValue({ mutateAsync: impersonateMutation, isPending: false })
    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "superadmin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "superadmin" },
        session: {},
      },
    })
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org 1", slug: "org-1" }],
      },
      isLoading: false,
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "create" || action === "impersonate"),
    )

    render(<UsersPage />)

    expect(screen.queryByText(/select organization for impersonation/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /impersonate user/i }))

    await waitFor(() => {
      expect(impersonateMutation).toHaveBeenCalledWith({
        userId: "target-1",
      })
    })
  })

  it("renders superadmin-sensitive user actions when capabilities allow them", () => {
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Target User",
            email: "target@example.com",
            role: "manager",
            emailVerified: true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: true,
            ban: true,
            unban: false,
            setPassword: false,
            remove: true,
            revokeSessions: false,
            impersonate: true,
          },
        },
      },
    })
    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "superadmin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "superadmin" },
        session: {},
      },
    })
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [{ id: "org-1", name: "Org 1", slug: "org-1" }],
      },
      isLoading: false,
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && ["read", "set-role", "ban", "delete", "impersonate"].includes(action),
    )

    render(<UsersPage />)

    expect(screen.getByRole("button", { name: /change role/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /ban user/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /delete user/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /impersonate user/i })).toBeInTheDocument()
  })

  it("renders memberships in all-organizations mode with one inline pill and overflow", () => {
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Target User",
            email: "target@example.com",
            role: "manager",
            emailVerified: true,
            banned: false,
            memberships: [
              {
                organizationId: "org-1",
                organizationName: "Org 1",
                roleName: "admin",
                roleDisplayName: "Admin",
              },
              {
                organizationId: "org-2",
                organizationName: "Org 2",
                roleName: "manager",
                roleDisplayName: "Manager",
              },
              {
                organizationId: "org-3",
                organizationName: "Org 3",
                roleName: "member",
                roleDisplayName: "Member",
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "superadmin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "superadmin" },
        session: {},
      },
    })
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org 1", slug: "org-1" },
          { id: "org-2", name: "Org 2", slug: "org-2" },
          { id: "org-3", name: "Org 3", slug: "org-3" },
        ],
      },
      isLoading: false,
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "create"),
    )

    render(<UsersPage />)

    expect(screen.getByText("Memberships")).toBeInTheDocument()
    expect(screen.queryByText(/^Role$/)).not.toBeInTheDocument()
    expect(screen.getByText("Org 1 · Admin")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument()
    expect(screen.getByText("Org 3 · Member")).toBeInTheDocument()
  })

  it("keeps the role column when a specific organization is selected", async () => {
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Target User",
            email: "target@example.com",
            role: "manager",
            emailVerified: true,
            banned: false,
            memberships: [
              {
                organizationId: "org-2",
                organizationName: "Org 2",
                roleName: "manager",
                roleDisplayName: "Manager",
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "superadmin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "superadmin" },
        session: {},
      },
    })
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org 1", slug: "org-1" },
          { id: "org-2", name: "Org 2", slug: "org-2" },
        ],
      },
      isLoading: false,
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "create"),
    )

    render(<UsersPage />)

    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: "org-2" } })

    await waitFor(() => {
      expect(screen.getByText("Role")).toBeInTheDocument()
      expect(screen.queryByText("Memberships")).not.toBeInTheDocument()
      expect(screen.getByText("manager")).toBeInTheDocument()
    })
  })

  it("filters users by selected organization for superadmin and defaults to all organizations", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "superadmin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "superadmin" },
        session: {},
      },
    })
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org 1", slug: "org-1" },
          { id: "org-2", name: "Org 2", slug: "org-2" },
        ],
      },
      isLoading: false,
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "create"),
    )

    render(<UsersPage />)

    expect(mockUseUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        organizationId: undefined,
      }),
    )

    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: "org-2" } })

    await waitFor(() => {
      expect(mockUseUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          organizationId: "org-2",
        }),
      )
    })
  })

  it("uses the selected organization for impersonation when a superadmin filter is chosen", async () => {
    const impersonateMutation = vi.fn().mockResolvedValue(undefined)

    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Target User",
            email: "target@example.com",
            role: "manager",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: false,
            ban: false,
            unban: false,
            setPassword: false,
            remove: false,
            revokeSessions: false,
            impersonate: true,
          },
        },
      },
    })
    mockUseImpersonateUser.mockReturnValue({ mutateAsync: impersonateMutation, isPending: false })
    mockUseAuth.mockReturnValue({ user: { id: "actor-1", role: "superadmin" } })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "actor-1", role: "superadmin" },
        session: {},
      },
    })
    mockUseOrganizations.mockReturnValue({
      data: {
        data: [
          { id: "org-1", name: "Org 1", slug: "org-1" },
          { id: "org-2", name: "Org 2", slug: "org-2" },
        ],
      },
      isLoading: false,
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "impersonate"),
    )

    render(<UsersPage />)

    fireEvent.change(screen.getByLabelText(/organization/i), { target: { value: "org-2" } })
    fireEvent.click(screen.getByRole("button", { name: /impersonate user/i }))

    await waitFor(() => {
      expect(impersonateMutation).toHaveBeenCalledWith({
        userId: "target-1",
        organizationId: "org-2",
      })
    })
  })

  it("editUser flow: opens edit dialog, changes name, submits", async () => {
    const updateUserMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
    mockUseUpdateUser.mockReturnValue(updateUserMutation)
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Target User",
            email: "target@example.com",
            role: "member",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: true,
            setRole: false,
            ban: false,
            unban: false,
            setPassword: false,
            remove: false,
            revokeSessions: false,
            impersonate: false,
          },
        },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "update"),
    )

    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /edit user/i }))
    const nameInput = screen.getByLabelText(/^name$/i)
    fireEvent.change(nameInput, { target: { value: "Updated Name" } })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(updateUserMutation.mutateAsync).toHaveBeenCalledWith({
        userId: "target-1",
        data: { name: "Updated Name" },
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("User updated successfully")
  })

  it("banUser flow: opens ban dialog and submits ban", async () => {
    const banUserMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
    mockUseBanUser.mockReturnValue(banUserMutation)
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Bad Actor",
            email: "bad@example.com",
            role: "member",
            emailVerified: true,
            banned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: false,
            ban: true,
            unban: false,
            setPassword: false,
            remove: false,
            revokeSessions: false,
            impersonate: false,
          },
        },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "ban"),
    )

    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /ban user/i }))
    const banDialog = await screen.findByRole("dialog")
    fireEvent.click(within(banDialog).getByRole("button", { name: /^ban user$/i }))

    await waitFor(() => {
      expect(banUserMutation.mutateAsync).toHaveBeenCalledWith({
        userId: "target-1",
        banReason: "",
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("User banned successfully")
  })

  it("unbanUser: directly unbans without dialog", async () => {
    const unbanUserMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
    mockUseUnbanUser.mockReturnValue(unbanUserMutation)
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Banned User",
            email: "banned@example.com",
            role: "member",
            emailVerified: true,
            banned: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: false,
            ban: false,
            unban: true,
            setPassword: false,
            remove: false,
            revokeSessions: false,
            impersonate: false,
          },
        },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "ban"),
    )

    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /unban user/i }))

    await waitFor(() => {
      expect(unbanUserMutation.mutateAsync).toHaveBeenCalledWith("target-1")
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("User unbanned successfully")
  })

  it("deleteUser flow: opens delete dialog, confirms deletion", async () => {
    const removeUserMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
    mockUseRemoveUser.mockReturnValue(removeUserMutation)
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "Delete Me",
            email: "delete@example.com",
            role: "member",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: false,
            ban: false,
            unban: false,
            setPassword: false,
            remove: true,
            revokeSessions: false,
            impersonate: false,
          },
        },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "delete"),
    )

    render(<UsersPage />)

    // The delete dropdown item button has aria-hidden icon; find the DropdownMenuItem
    fireEvent.click(screen.getByRole("button", { name: /delete user/i }))
    const deleteDialog = await screen.findByRole("dialog")
    fireEvent.click(within(deleteDialog).getByRole("button", { name: /^delete user$/i }))

    await waitFor(() => {
      expect(removeUserMutation.mutateAsync).toHaveBeenCalledWith("target-1")
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("User deleted successfully")
  })

  it("setPassword flow: opens password dialog, submits new password", async () => {
    const setPasswordMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
    mockUseSetUserPassword.mockReturnValue(setPasswordMutation)
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "User",
            email: "user@example.com",
            role: "member",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: false,
            ban: false,
            unban: false,
            setPassword: true,
            remove: false,
            revokeSessions: false,
            impersonate: false,
          },
        },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "set-password"),
    )

    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }))
    const passwordInput = screen.getByLabelText(/new password/i)
    fireEvent.change(passwordInput, { target: { value: "NewPass123!" } })
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: /^reset password$/i }))

    await waitFor(() => {
      expect(setPasswordMutation.mutateAsync).toHaveBeenCalledWith({
        userId: "target-1",
        newPassword: "NewPass123!",
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("Password updated successfully")
  })

  it("setRole flow: opens role dialog and submits new role", async () => {
    const setRoleMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
    mockUseSetUserRole.mockReturnValue(setRoleMutation)
    mockGetCreateUserMetadata.mockResolvedValue({
      roles: [
        { name: "admin", displayName: "Admin" },
        { name: "member", displayName: "Member" },
      ],
      allowedRoleNames: ["admin", "member"],
      organizations: [],
    })
    mockUseUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "target-1",
            name: "User",
            email: "user@example.com",
            role: "member",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    })
    mockUseUserCapabilitiesBatch.mockReturnValue({
      data: {
        "target-1": {
          actions: {
            update: false,
            setRole: true,
            ban: false,
            unban: false,
            setPassword: false,
            remove: false,
            revokeSessions: false,
            impersonate: false,
          },
        },
      },
    })
    mockCan.mockImplementation((resource: string, action: string) =>
      resource === "user" && (action === "read" || action === "set-role"),
    )

    render(<UsersPage />)

    fireEvent.click(screen.getByRole("button", { name: /change role/i }))

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /update role/i }))

    await waitFor(() => {
      expect(setRoleMutation.mutateAsync).toHaveBeenCalledWith({
        userId: "target-1",
        role: "member",
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("Role updated successfully")
  })
})
