import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

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
  mockUseAuth,
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
  mockUseAuth: vi.fn(),
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

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
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
  ServerDataTable: ({ toolbar }: { toolbar?: ReactNode }) => <div>{toolbar}</div>,
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
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
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

    mockUseAuth.mockReturnValue({ user: { id: "actor-1" } })
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
})
