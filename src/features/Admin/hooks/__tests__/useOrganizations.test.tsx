import { describe, it, expect, beforeEach, vi, type Mock } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import {
  useOrganizations,
  useOrganization,
  useOrganizationMembers,
  useOrganizationInvitations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useInviteMember,
  useAddMember,
  useUserInvitations,
  useAcceptInvitation,
  useRejectInvitation,
  useActiveMember,
  useActiveMemberRole,
  useRemoveMember,
  useUpdateMemberRole,
  useLeaveOrganization,
  useSetActiveOrganization,
  useCheckSlug,
  organizationKeys,
} from "../useOrganizations"
import { organizationService } from "../../services/adminService"

const mockUseEffectiveSession = vi.fn()

// Mock the organization service
vi.mock("../../services/adminService", () => ({
  organizationService: {
    listOrganizations: vi.fn(),
    getOrganization: vi.fn(),
    listMembers: vi.fn(),
    listInvitations: vi.fn(),
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    inviteMember: vi.fn(),
    addMember: vi.fn(),
    listUserInvitations: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
    getActiveMember: vi.fn(),
    getActiveMemberRole: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    leaveOrganization: vi.fn(),
    setActive: vi.fn(),
    checkSlug: vi.fn(),
  },
}))

vi.mock("@/shared/hooks/useEffectiveSession", () => ({
  useEffectiveSession: () => mockUseEffectiveSession(),
}))

// Get typed mock references
const mockOrgService = organizationService as unknown as {
  listOrganizations: Mock
  getOrganization: Mock
  listMembers: Mock
  listInvitations: Mock
  createOrganization: Mock
  updateOrganization: Mock
  deleteOrganization: Mock
  inviteMember: Mock
  addMember: Mock
  listUserInvitations: Mock
  acceptInvitation: Mock
  rejectInvitation: Mock
  getActiveMember: Mock
  getActiveMemberRole: Mock
  removeMember: Mock
  updateMemberRole: Mock
  leaveOrganization: Mock
  setActive: Mock
  checkSlug: Mock
}

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useOrganizations hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEffectiveSession.mockReturnValue({
      data: {
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      },
    })
  })

  describe("organizationKeys", () => {
    it("should generate correct query keys", () => {
      expect(organizationKeys.all).toEqual(["organizations"])
      expect(organizationKeys.list({}, { userId: "user-1", activeOrganizationId: "org-1" })).toEqual(["organizations", "list", "user-1", "org-1", {}])
      expect(organizationKeys.detail("org-1", { userId: "user-1", activeOrganizationId: "org-1" })).toEqual(["organizations", "detail", "user-1", "org-1", "org-1"])
      expect(organizationKeys.userInvitations()).toEqual(["organizations", "userInvitations"])
      expect(organizationKeys.activeMember()).toEqual(["organizations", "activeMember"])
    })

    it("should fall back to anonymous query scope", () => {
      expect(organizationKeys.members("org-1")).toEqual(["organizations", "members", "anonymous", "no-org", "org-1"])
    })
  })

  describe("useOrganizations", () => {
    it("should fetch organizations list", async () => {
      const mockOrgs = [
        { id: "org-1", name: "Org 1", slug: "org-1", createdAt: new Date(), logo: null, metadata: {} },
        { id: "org-2", name: "Org 2", slug: "org-2", createdAt: new Date(), logo: null, metadata: {} },
      ]
      mockOrgService.listOrganizations.mockResolvedValue(mockOrgs)

      const { result } = renderHook(() => useOrganizations(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOrgs)
      expect(mockOrgService.listOrganizations).toHaveBeenCalledTimes(1)
    })
  })

  describe("useUserInvitations", () => {
    it("should fetch user invitations", async () => {
      const mockInvitations = [
        { id: "inv-1", email: "test@example.com", role: "member", status: "pending", organizationId: "org-1", inviterId: "user-1", expiresAt: new Date(), createdAt: new Date() },
      ]
      mockOrgService.listUserInvitations.mockResolvedValue(mockInvitations)

      const { result } = renderHook(() => useUserInvitations(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockInvitations)
    })
  })

  describe("useAcceptInvitation", () => {
    it("should accept an invitation", async () => {
      mockOrgService.acceptInvitation.mockResolvedValue({})

      const { result } = renderHook(() => useAcceptInvitation(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync("inv-1")

      expect(mockOrgService.acceptInvitation).toHaveBeenCalledWith("inv-1")
    })
  })

  describe("useRejectInvitation", () => {
    it("should reject an invitation", async () => {
      mockOrgService.rejectInvitation.mockResolvedValue(undefined)

      const { result } = renderHook(() => useRejectInvitation(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync("inv-1")

      expect(mockOrgService.rejectInvitation).toHaveBeenCalledWith("inv-1")
    })
  })

  describe("useActiveMember", () => {
    it("should fetch active member", async () => {
      const mockMember = { id: "member-1", role: "admin", organizationId: "org-1", createdAt: new Date(), userId: "user-1" }
      mockOrgService.getActiveMember.mockResolvedValue(mockMember)

      const { result } = renderHook(() => useActiveMember(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockMember)
    })
  })

  describe("useLeaveOrganization", () => {
    it("should leave an organization", async () => {
      mockOrgService.leaveOrganization.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLeaveOrganization(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync("org-1")

      expect(mockOrgService.leaveOrganization).toHaveBeenCalledWith("org-1")
    })
  })

  describe("useRemoveMember", () => {
    it("should remove a member", async () => {
      mockOrgService.removeMember.mockResolvedValue(undefined)

      const { result } = renderHook(() => useRemoveMember(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({ organizationId: "org-1", memberId: "member-1" })

      expect(mockOrgService.removeMember).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-1",
      })
    })
  })

  describe("useUpdateMemberRole", () => {
    it("should update member role", async () => {
      mockOrgService.updateMemberRole.mockResolvedValue(undefined)

      const { result } = renderHook(() => useUpdateMemberRole(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({ organizationId: "org-1", memberId: "member-1", role: "manager" })

      expect(mockOrgService.updateMemberRole).toHaveBeenCalledWith({
        organizationId: "org-1",
        memberId: "member-1",
        role: "manager",
      })
    })
  })

  describe("useSetActiveOrganization", () => {
    it("should set active organization", async () => {
      mockOrgService.setActive.mockResolvedValue(undefined)

      const { result } = renderHook(() => useSetActiveOrganization(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync("org-1")

      expect(mockOrgService.setActive).toHaveBeenCalledWith("org-1")
    })
  })

  describe("useCheckSlug", () => {
    it("should check if slug is available", async () => {
      mockOrgService.checkSlug.mockResolvedValue({ status: true })

      const { result } = renderHook(() => useCheckSlug(), {
        wrapper: createWrapper(),
      })

      const checkResult = await result.current.mutateAsync("my-org")

      expect(mockOrgService.checkSlug).toHaveBeenCalledWith("my-org")
      expect(checkResult).toEqual({ status: true })
    })

    it("should return false for taken slug", async () => {
      mockOrgService.checkSlug.mockResolvedValue({ status: false })

      const { result } = renderHook(() => useCheckSlug(), {
        wrapper: createWrapper(),
      })

      const checkResult = await result.current.mutateAsync("existing-org")

      expect(checkResult).toEqual({ status: false })
    })
  })

  describe("useOrganization", () => {
    it("should fetch a single organization by id", async () => {
      const mockOrg = { id: "org-1", name: "Org 1", slug: "org-1" }
      mockOrgService.getOrganization.mockResolvedValue(mockOrg)

      const { result } = renderHook(() => useOrganization("org-1"), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockOrg)
      expect(mockOrgService.getOrganization).toHaveBeenCalledWith("org-1")
    })

    it("should be disabled when organizationId is empty", () => {
      const { result } = renderHook(() => useOrganization(""), {
        wrapper: createWrapper(),
      })

      expect(result.current.fetchStatus).toBe("idle")
    })
  })

  describe("useOrganizationMembers", () => {
    it("should fetch members for an organization", async () => {
      const mockMembers = [{ id: "m-1", userId: "u-1", role: "member", organizationId: "org-1" }]
      mockOrgService.listMembers.mockResolvedValue(mockMembers)

      const { result } = renderHook(() => useOrganizationMembers("org-1"), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockMembers)
      expect(mockOrgService.listMembers).toHaveBeenCalledWith("org-1")
    })

    it("should be disabled when organizationId is empty", () => {
      const { result } = renderHook(() => useOrganizationMembers(""), {
        wrapper: createWrapper(),
      })

      expect(result.current.fetchStatus).toBe("idle")
    })
  })

  describe("useOrganizationInvitations", () => {
    it("should fetch invitations for an organization", async () => {
      const mockInvitations = [{ id: "inv-1", email: "user@example.com", role: "member", status: "pending" }]
      mockOrgService.listInvitations.mockResolvedValue(mockInvitations)

      const { result } = renderHook(() => useOrganizationInvitations("org-1"), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockInvitations)
      expect(mockOrgService.listInvitations).toHaveBeenCalledWith("org-1")
    })

    it("should be disabled when organizationId is empty", () => {
      const { result } = renderHook(() => useOrganizationInvitations(""), {
        wrapper: createWrapper(),
      })

      expect(result.current.fetchStatus).toBe("idle")
    })
  })

  describe("useCreateOrganization", () => {
    it("should create an organization", async () => {
      const newOrg = { id: "org-new", name: "New Org", slug: "new-org" }
      mockOrgService.createOrganization.mockResolvedValue(newOrg)

      const { result } = renderHook(() => useCreateOrganization(), {
        wrapper: createWrapper(),
      })

      const created = await result.current.mutateAsync({ name: "New Org", slug: "new-org" })

      expect(mockOrgService.createOrganization).toHaveBeenCalledWith({ name: "New Org", slug: "new-org" })
      expect(created).toEqual(newOrg)
    })
  })

  describe("useUpdateOrganization", () => {
    it("should update an organization", async () => {
      const updated = { id: "org-1", name: "Updated Org", slug: "org-1" }
      mockOrgService.updateOrganization.mockResolvedValue(updated)

      const { result } = renderHook(() => useUpdateOrganization(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({ organizationId: "org-1", data: { name: "Updated Org" } })

      expect(mockOrgService.updateOrganization).toHaveBeenCalledWith("org-1", { name: "Updated Org" })
    })
  })

  describe("useDeleteOrganization", () => {
    it("should delete an organization", async () => {
      mockOrgService.deleteOrganization.mockResolvedValue(undefined)

      const { result } = renderHook(() => useDeleteOrganization(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync("org-1")

      expect(mockOrgService.deleteOrganization).toHaveBeenCalledWith("org-1")
    })
  })

  describe("useInviteMember", () => {
    it("should invite a member to an organization", async () => {
      mockOrgService.inviteMember.mockResolvedValue({ id: "inv-1" })

      const { result } = renderHook(() => useInviteMember(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({ organizationId: "org-1", email: "user@example.com", role: "member" })

      expect(mockOrgService.inviteMember).toHaveBeenCalledWith({
        organizationId: "org-1",
        email: "user@example.com",
        role: "member",
      })
    })
  })

  describe("useAddMember", () => {
    it("should add an existing user to an organization", async () => {
      mockOrgService.addMember.mockResolvedValue({ id: "m-1" })

      const { result } = renderHook(() => useAddMember(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({ organizationId: "org-1", userId: "user-1", role: "member" })

      expect(mockOrgService.addMember).toHaveBeenCalledWith("org-1", "user-1", "member")
    })
  })

  describe("useActiveMemberRole", () => {
    it("should fetch the active member role", async () => {
      const mockRole = { role: "manager" }
      mockOrgService.getActiveMemberRole.mockResolvedValue(mockRole)

      const { result } = renderHook(() => useActiveMemberRole(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockRole)
    })
  })

  describe("organizationKeys completeness", () => {
    it("should generate members key", () => {
      expect(organizationKeys.members("org-1", { userId: "user-1", activeOrganizationId: "org-1" })).toEqual(["organizations", "members", "user-1", "org-1", "org-1"])
    })

    it("should generate invitations key", () => {
      expect(organizationKeys.invitations("org-1", { userId: "user-1", activeOrganizationId: "org-1" })).toEqual(["organizations", "invitations", "user-1", "org-1", "org-1"])
    })

    it("should generate lists key", () => {
      expect(organizationKeys.lists()).toEqual(["organizations", "list"])
    })

    it("should generate details key", () => {
      expect(organizationKeys.details()).toEqual(["organizations", "detail"])
    })
  })
})
