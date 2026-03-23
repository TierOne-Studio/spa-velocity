import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"

const {
  mockUseAuth,
  mockUseEffectiveSession,
  mockFetchWithAuth,
  mockInvalidateQueries,
  mockQueryClient,
} = vi.hoisted(() => {
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
  const mockQueryClient = { invalidateQueries: mockInvalidateQueries }
  return {
    mockUseAuth: vi.fn(),
    mockUseEffectiveSession: vi.fn(),
    mockFetchWithAuth: vi.fn(),
    mockInvalidateQueries,
    mockQueryClient,
  }
})

vi.mock("@/shared/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}))

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query")
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  }
})

vi.mock("@/shared/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { OrganizationSwitcher } from "../OrganizationSwitcher"

const ORG = { id: "org-1", name: "Test Org", slug: "test-org" }
const buildResponse = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
})

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { role: "member" },
      refreshSession: vi.fn().mockResolvedValue(undefined),
    })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        session: { activeOrganizationId: "org-1" },
      },
    })
    mockFetchWithAuth.mockImplementation((url: unknown, options?: RequestInit) => {
      const requestUrl = String(url)

      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG] }))
      }

      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }

      if (requestUrl.includes("/api/auth/organization/set-active")) {
        expect(options?.method).toBe("POST")
        return Promise.resolve(buildResponse({ data: null }))
      }

      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("renders a skeleton while organizations are loading", () => {
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return new Promise(() => {})
      }
      return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
    })

    render(<OrganizationSwitcher />)

    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("renders an interactive organization dropdown for authenticated users", async () => {
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG, { id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      if (requestUrl.includes("/api/auth/organization/set-active")) {
        return Promise.resolve(buildResponse({ data: null }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    render(<OrganizationSwitcher />)

    const button = await waitFor(() => screen.getByRole("button", { name: /test org/i }))

    expect(button).toBeEnabled()
  })

  it("shows a disabled selector when the user belongs to only one organization", async () => {
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    expect(trigger).toBeDisabled()
  })

  it("does not refetch initial org data on rerender when auth context changes identity", async () => {
    mockUseAuth.mockImplementation(() => ({
      user: { role: "member" },
      refreshSession: vi.fn().mockResolvedValue(undefined),
    }))

    const { rerender } = render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeInTheDocument()
    })

    rerender(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })
  })

  it("syncs the displayed organization when activeOrganizationId changes externally", async () => {
    let currentSession = {
      user: { id: "target-1", role: "manager" },
      session: { activeOrganizationId: "org-1" },
    }

    mockUseEffectiveSession.mockImplementation(() => ({
      data: currentSession,
    }))
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG, { id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    const { rerender } = render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeEnabled()
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })

    currentSession = {
      user: { id: "target-1", role: "manager" },
      session: { activeOrganizationId: "org-2" },
    }

    rerender(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /second org/i })).toBeEnabled()
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })
  })

  it("refetches organizations when the authenticated user changes but the role stays the same", async () => {
    const mockRefreshSession = vi.fn().mockResolvedValue(undefined)
    let currentUser = { id: "user-1", role: "member" }

    mockUseAuth.mockImplementation(() => ({
      user: currentUser,
      refreshSession: mockRefreshSession,
    }))

    mockUseEffectiveSession.mockReturnValue({
      data: {
        session: {},
      },
    })
    mockFetchWithAuth.mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: null }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    }).mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: null }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    }).mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [{ id: "org-2", name: "Test Org", slug: "test-org" }] }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    }).mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-2" } }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    const { rerender } = render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /no organization/i })).toBeDisabled()
    })

    currentUser = { id: "user-2", role: "member" }
    rerender(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeDisabled()
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(4)
    })
  })

  it("calls setActive and refreshes session on org click", async () => {
    const mockRefreshSession = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: { role: "member" }, refreshSession: mockRefreshSession })
    mockFetchWithAuth.mockImplementation((url: unknown, options?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG, { id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      if (requestUrl.includes("/api/auth/organization/set-active")) {
        expect(options?.method).toBe("POST")
        expect(options?.body).toBe(JSON.stringify({ organizationId: "org-1" }))
        return Promise.resolve(buildResponse({ data: null }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    const user = userEvent.setup()
    render(<OrganizationSwitcher />)

    const trigger = await waitFor(() => screen.getByRole("button", { name: /test org/i }))
    await user.click(trigger)

    const menuItem = await screen.findByRole("menuitem", { name: /^test org$/i })
    await user.click(menuItem)

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/organization/set-active"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ organizationId: "org-1" }),
        }),
      )
      expect(toast.success).toHaveBeenCalledWith("Switched organization")
      expect(mockRefreshSession).toHaveBeenCalled()
      expect(mockInvalidateQueries).toHaveBeenCalled()
    })

    expect(screen.queryByRole("menuitem", { name: /create organization/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: /leave/i })).not.toBeInTheDocument()
  })

  it("shows error toast when setActive fails", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "member" }, refreshSession: vi.fn().mockResolvedValue(undefined) })
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG, { id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      if (requestUrl.includes("/api/auth/organization/set-active")) {
        return Promise.resolve(buildResponse({ message: "Switch failed" }, false))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

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

  it("returns null for superadmin users", async () => {
    mockUseAuth.mockReturnValue({
      user: { role: "superadmin" },
      refreshSession: vi.fn().mockResolvedValue(undefined),
    })
    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.queryByRole("button")).toBeNull()
    })
  })

  it("uses the effective session role during impersonation instead of hiding the switcher for the actor role", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "actor-1", role: "superadmin" },
      refreshSession: vi.fn().mockResolvedValue(undefined),
    })
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "target-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
    })
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG, { id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      if (requestUrl.includes("/api/auth/organization/set-active")) {
        return Promise.resolve(buildResponse({ data: null }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeEnabled()
    })
  })

  it("refetches organizations when the effective session user changes during impersonation", async () => {
    const mockRefreshSession = vi.fn().mockResolvedValue(undefined)
    let currentSession = {
      user: { id: "target-1", role: "manager" },
      session: { activeOrganizationId: "org-1" },
    }

    mockUseAuth.mockReturnValue({
      user: { id: "actor-1", role: "admin" },
      refreshSession: mockRefreshSession,
    })
    mockUseEffectiveSession.mockImplementation(() => ({
      data: currentSession,
    }))
    mockFetchWithAuth.mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG] }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    }).mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    }).mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [{ id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    }).mockImplementationOnce((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-2" } }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    const { rerender } = render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeDisabled()
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })

    currentSession = {
      user: { id: "target-2", role: "manager" },
      session: { activeOrganizationId: "org-2" },
    }

    rerender(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /second org/i })).toBeDisabled()
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(4)
    })
  })

  it("shows 'No Organization' when the list is empty", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        session: {},
      },
    })
    mockFetchWithAuth.mockReset()
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: null }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /no organization/i })).toBeDisabled()
    })
  })

  it("lists organizations from the auth organization API for impersonated sessions", async () => {
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "target-1", role: "manager" },
        session: { activeOrganizationId: "org-1" },
      },
    })
    mockFetchWithAuth.mockImplementation((url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/api/auth/organization/list")) {
        return Promise.resolve(buildResponse({ data: [ORG, { id: "org-2", name: "Second Org", slug: "second-org" }] }))
      }
      if (requestUrl.includes("/api/auth/organization/get-active-member")) {
        return Promise.resolve(buildResponse({ data: { organizationId: "org-1" } }))
      }
      return Promise.reject(new Error(`Unexpected URL: ${requestUrl}`))
    })

    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test org/i })).toBeEnabled()
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/organization/list"),
      )
    })
  })
})
