import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"

const {
  mockUsePermissionsContext,
  mockUseAuth,
  mockCreateOrganization,
  mockOrganization,
  mockInvalidateQueries,
  mockQueryClient,
} = vi.hoisted(() => {
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
  const mockQueryClient = { invalidateQueries: mockInvalidateQueries }
  return {
    mockUsePermissionsContext: vi.fn(),
    mockUseAuth: vi.fn(),
    mockCreateOrganization: vi.fn(),
    mockOrganization: {
      list: vi.fn(),
      getActiveMember: vi.fn(),
      setActive: vi.fn(),
      leave: vi.fn(),
    },
    mockInvalidateQueries,
    mockQueryClient,
  }
})

vi.mock("@/shared/context/PermissionsContext", () => ({
  usePermissionsContext: () => mockUsePermissionsContext(),
}))

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  }
})

vi.mock("@/shared/lib/auth-client", () => ({
  organization: mockOrganization,
}))

vi.mock("@/features/Admin/services/adminService", () => ({
  organizationService: {
    createOrganization: (...args: unknown[]) => mockCreateOrganization(...args),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { OrganizationSwitcher } from "../OrganizationSwitcher"

const ORG = { id: "org-1", name: "Test Org", slug: "test-org" }

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissionsContext.mockReturnValue({ can: () => false })
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockOrganization.list.mockResolvedValue({ data: [ORG] })
    mockOrganization.getActiveMember.mockResolvedValue({ data: { organizationId: "org-1" } })
    mockOrganization.setActive.mockResolvedValue({ data: null, error: null })
    mockOrganization.leave.mockResolvedValue({ data: null, error: null })
    mockCreateOrganization.mockResolvedValue({ id: "org-2", name: "New Org" })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("renders a skeleton while organizations are loading", () => {
    mockOrganization.list.mockReturnValue(new Promise(() => {}))

    render(<OrganizationSwitcher />)

    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("renders an interactive organization dropdown for authenticated users", async () => {
    render(<OrganizationSwitcher />)

    const button = await waitFor(() => screen.getByRole("button", { name: /test org/i }))

    expect(button).toBeEnabled()
  })

  it("shows 'No organizations' when the list is empty", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockOrganization.list.mockResolvedValue({ data: [] })
    mockOrganization.getActiveMember.mockResolvedValue({ data: null })

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /select organization/i }))
    await user.click(trigger)

    expect(await screen.findByText("No organizations")).toBeInTheDocument()
  })

  it("does not refetch initial org data on rerender when auth context changes identity", async () => {
    mockUseAuth.mockImplementation(() => ({ refreshSession: vi.fn().mockResolvedValue(undefined) }))

    const { rerender } = render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeInTheDocument()
    })

    rerender(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(mockOrganization.list).toHaveBeenCalledTimes(1)
      expect(mockOrganization.getActiveMember).toHaveBeenCalledTimes(1)
    })
  })

  it("calls setActive and refreshes session on org click", async () => {
    const mockRefreshSession = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ refreshSession: mockRefreshSession })

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const menuItem = await screen.findByRole("menuitem", { name: /^test org$/i })
    await user.click(menuItem)

    await waitFor(() => {
      expect(mockOrganization.setActive).toHaveBeenCalledWith({ organizationId: "org-1" })
      expect(toast.success).toHaveBeenCalledWith("Switched organization")
      expect(mockRefreshSession).toHaveBeenCalled()
      expect(mockInvalidateQueries).toHaveBeenCalled()
    })
  })

  it("shows error toast when setActive fails", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockOrganization.setActive.mockRejectedValue(new Error("Switch failed"))

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const menuItem = await screen.findByRole("menuitem", { name: /^test org$/i })
    await user.click(menuItem)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Switch failed")
    })
  })

  it("calls leave and shows success toast when leaving an org", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const leaveItem = await screen.findByRole("menuitem", { name: /leave test org/i })
    await user.click(leaveItem)

    await waitFor(() => {
      expect(mockOrganization.leave).toHaveBeenCalledWith({ organizationId: "org-1" })
      expect(toast.success).toHaveBeenCalledWith("Left organization")
    })
  })

  it("shows error toast when createOrg fails", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockUsePermissionsContext.mockReturnValue({ can: () => true })
    mockCreateOrganization.mockRejectedValue(new Error("Create failed"))

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const createItem = await screen.findByRole("menuitem", { name: /create organization/i })
    await user.click(createItem)

    const nameInput = await screen.findByLabelText(/name/i)
    await user.type(nameInput, "New Org")

    const createBtn = within(screen.getByRole("dialog")).getByRole("button", { name: /^create$/i })
    await user.click(createBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Create failed")
    })
  })

  it("closes create org dialog when Cancel is clicked", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockUsePermissionsContext.mockReturnValue({ can: () => true })

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const createItem = await screen.findByRole("menuitem", { name: /create organization/i })
    await user.click(createItem)

    const cancelBtn = await screen.findByRole("button", { name: /cancel/i })
    await user.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("shows error toast when leaving an org fails", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockOrganization.leave.mockRejectedValue(new Error("Leave failed"))

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const leaveItem = await screen.findByRole("menuitem", { name: /leave test org/i })
    await user.click(leaveItem)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Leave failed")
    })
  })

  it("opens create org dialog and submits when user has create permission", async () => {
    mockUseAuth.mockReturnValue({ refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockUsePermissionsContext.mockReturnValue({ can: () => true })

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const createItem = await screen.findByRole("menuitem", { name: /create organization/i })
    await user.click(createItem)

    const nameInput = await screen.findByLabelText(/name/i)
    const slugInput = screen.getByLabelText(/slug/i)

    await user.type(nameInput, "New Org")
    await user.type(slugInput, "new-org")

    const createBtn = within(screen.getByRole("dialog")).getByRole("button", { name: /^create$/i })
    await user.click(createBtn)

    await waitFor(() => {
      expect(mockCreateOrganization).toHaveBeenCalledWith({ name: "New Org", slug: "new-org" })
      expect(toast.success).toHaveBeenCalledWith("Organization created successfully")
    })
  })
})
