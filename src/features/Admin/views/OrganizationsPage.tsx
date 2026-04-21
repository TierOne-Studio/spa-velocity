import { useState, useEffect } from "react"
import {
  IconDotsVertical,
  IconPlus,
  IconTrash,
  IconEdit,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/shared/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
  MultiSelectCombobox,
  type MultiSelectOption,
} from "@/shared/components/ui/multi-select-combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

import {
  useOrganizations,
  useOrganizationMembers,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useRemoveMember,
  useUpdateMemberRole,
  useAddMember,
  useCheckSlug,
  useSetActiveOrganization,
} from "../hooks/useOrganizations"
import { useAirweaveCollections } from "../hooks/useAirweaveCollections"
import { organizationService } from "../services/adminService"
import { getOrganizationRolesMetadata } from "../services/adminService"
import { usePermissionsContext } from "@/shared/context/PermissionsContext"
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession"
import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities"

interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
  createdAt: Date
  metadata?: unknown
}

interface Member {
  id: string
  userId: string
  role: string
  user?: {
    id: string
    name: string
    email: string
    image?: string
  }
}

interface User {
  id: string
  name: string
  email: string
  image?: string | null
}

type OrganizationFormState = {
  name: string
  slug: string
  allowedAirweaveCollectionIds: string[]
}

const dedupeRoleNames = (roleNames: string[]) => Array.from(new Set(roleNames))

// Helper to extract members array from response
const getMembersArray = (data: unknown): Member[] => {
  if (!data) return []
  if (Array.isArray(data)) return data as Member[]
  if (typeof data === "object" && "members" in data) {
    return (data as { members: Member[] }).members
  }
  return []
}

const readOrganizationMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {}
  }

  return { ...(metadata as Record<string, unknown>) }
}

const readOrganizationAllowedCollectionIds = (metadata: unknown): string[] => {
  const base = readOrganizationMetadata(metadata)
  const raw = base.allowedAirweaveCollectionIds
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
  }
  const legacy = base.airweaveCollectionId
  if (typeof legacy === "string" && legacy.trim().length > 0) {
    return [legacy.trim()]
  }
  return []
}

const buildOrganizationMetadata = (
  metadata: unknown,
  allowedAirweaveCollectionIds: string[],
): Record<string, unknown> | undefined => {
  const nextMetadata = readOrganizationMetadata(metadata)
  const dedup = Array.from(
    new Set(
      allowedAirweaveCollectionIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  )

  nextMetadata.allowedAirweaveCollectionIds = dedup

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined
}


export function OrganizationsPage() {
  const { can, refetchPermissions } = usePermissionsContext()
  const { refetch: refetchSession } = useEffectiveSession()

  // State
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [optimisticActiveOrganizationId, setOptimisticActiveOrganizationId] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const pageSize = 10

  // Form state
  const [newOrgData, setNewOrgData] = useState<OrganizationFormState>({
    name: "",
    slug: "",
    allowedAirweaveCollectionIds: [],
  })
  const [editOrgData, setEditOrgData] = useState<OrganizationFormState>({
    name: "",
    slug: "",
    allowedAirweaveCollectionIds: [],
  })
  const [addMemberData, setAddMemberData] = useState({ userId: "", role: "member" })
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")

  // Organization roles metadata (fetched from backend)
  const [orgRolesMeta, setOrgRolesMeta] = useState<{
    roles: Array<{ name: string; displayName: string; description: string | null; color: string | null; isSystem: boolean }>;
    assignableRoles: string[];
  } | null>(null)

  const { isSuperadmin, activeOrganizationId } = useOrgCapabilities()
  const currentActiveOrganizationId = optimisticActiveOrganizationId ?? activeOrganizationId
  const canManageOrganizationFromPage = (organizationId: string) =>
    isSuperadmin || organizationId === currentActiveOrganizationId
  const canManageSelectedOrganization =
    !!selectedOrg && canManageOrganizationFromPage(selectedOrg.id)
  const canReadCollections = can('project', 'read')

  // Queries
  const { data: orgsResponse, isLoading: orgsLoading } = useOrganizations({ page, limit: pageSize, search: search || undefined })
  const { data: membersData, isLoading: membersLoading } = useOrganizationMembers(
    selectedOrg?.id ?? "",
  )
  const {
    data: availableCollections = [],
    isLoading: collectionsLoading,
    error: collectionsError,
  } = useAirweaveCollections({ enabled: canReadCollections })

  // Extract arrays from response data
  const organizations = orgsResponse?.data ?? []
  const totalPages = orgsResponse?.totalPages ?? 1
  const total = orgsResponse?.total ?? 0
  const members = getMembersArray(membersData)
  const selectedOrgAllowedCollectionIds = readOrganizationAllowedCollectionIds(selectedOrg?.metadata)
  const selectedOrgAllowedCollections = selectedOrgAllowedCollectionIds.map((id) => {
    const found = availableCollections.find((collection) => collection.readableId === id)
    return {
      readableId: id,
      name: found?.name ?? id,
      sourceConnectionCount: found?.sourceConnectionCount ?? null,
    }
  })
  const collectionOptions: MultiSelectOption[] = availableCollections.map((c) => ({
    value: c.readableId,
    label: c.name,
    description: c.readableId,
  }))

  // Mutations
  const createOrg = useCreateOrganization()
  const updateOrg = useUpdateOrganization()
  const deleteOrg = useDeleteOrganization()
  const addMember = useAddMember()
  const removeMember = useRemoveMember()
  const updateMemberRole = useUpdateMemberRole()
  const checkSlug = useCheckSlug()
  const setActiveOrganization = useSetActiveOrganization()

  useEffect(() => {
    if (activeOrganizationId !== null) {
      setOptimisticActiveOrganizationId(null)
    }
  }, [activeOrganizationId])

  useEffect(() => {
    setAvailableUsers([])
    setAddMemberData({ userId: "", role: "member" })
  }, [selectedOrg?.id])

  // Fetch organization roles metadata whenever the selected org changes
  useEffect(() => {
    const fetchRolesMeta = async () => {
      try {
        const meta = await getOrganizationRolesMetadata(selectedOrg?.id)
        setOrgRolesMeta(meta)
      } catch (error) {
        console.error("Failed to fetch organization roles metadata:", error)
      }
    }
    void fetchRolesMeta()
  }, [selectedOrg?.id])

  const canCreateOrg = can('organization', 'create')
  const canUpdateOrg = can('organization', 'update')
  const canDeleteOrg = can('organization', 'delete')
  const canManageMembers = can('organization', 'invite')
  const roleMetadataByName = new Map(
    (orgRolesMeta?.roles ?? []).map((role) => [role.name, role]),
  )

  const handleSelectOrganization = async (org: Organization) => {
    setSelectedOrg(org)

    if (isSuperadmin || org.id === currentActiveOrganizationId || setActiveOrganization.isPending) {
      return
    }

    // Optimistically mark the org as active so the detail panel renders without
    // showing the "Switch your active organization" warning during the async switch.
    setOptimisticActiveOrganizationId(org.id)

    try {
      await setActiveOrganization.mutateAsync(org.id)
      await refetchSession()
      refetchPermissions()
      toast.success("Switched organization")
    } catch (error) {
      setOptimisticActiveOrganizationId(null)  // revert on failure
      toast.error(error instanceof Error ? error.message : "Failed to switch organization")
    }
  }

  // Check slug availability with debounce
  const handleSlugChange = async (slug: string) => {
    const formattedSlug = slug.toLowerCase().replace(/\s+/g, "-")
    setNewOrgData({ ...newOrgData, slug: formattedSlug })
    
    if (formattedSlug.length < 3) {
      setSlugStatus("idle")
      return
    }

    setSlugStatus("checking")
    try {
      const result = await checkSlug.mutateAsync(formattedSlug)
      // result contains { status: boolean } where true means available
      setSlugStatus(result?.status ? "available" : "taken")
    } catch {
      setSlugStatus("idle")
    }
  }

  // Handlers
  const handleCreateOrg = async () => {
    if (!canCreateOrg) {
      toast.error("You do not have permission to create organizations")
      return
    }

    try {
      const createdOrganization = await createOrg.mutateAsync({
        name: newOrgData.name,
        slug: newOrgData.slug.toLowerCase().replace(/\s+/g, "-"),
        metadata: buildOrganizationMetadata(undefined, newOrgData.allowedAirweaveCollectionIds),
      })

      if (createdOrganization?.id) {
        setOptimisticActiveOrganizationId(createdOrganization.id)
        setSelectedOrg({ ...createdOrganization, createdAt: new Date(createdOrganization.createdAt) })

        try {
          await setActiveOrganization.mutateAsync(createdOrganization.id)
          await refetchSession()
          refetchPermissions()
        } catch (error) {
          setOptimisticActiveOrganizationId(null)
          toast.error(
            error instanceof Error
              ? `Organization created but failed to switch active organization: ${error.message}`
              : "Organization created but failed to switch active organization",
          )
        }
      }

      toast.success("Organization created successfully")
      setCreateDialogOpen(false)
      setNewOrgData({ name: "", slug: "", allowedAirweaveCollectionIds: [] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization")
    }
  }

  const handleUpdateOrg = async () => {
    if (!selectedOrg) return
    if (!canUpdateOrg || !canManageSelectedOrganization) {
      toast.error("You do not have permission to update organizations")
      return
    }

    try {
      await updateOrg.mutateAsync({
        organizationId: selectedOrg.id,
        data: {
          name: editOrgData.name,
          slug: editOrgData.slug,
          metadata: buildOrganizationMetadata(selectedOrg.metadata, editOrgData.allowedAirweaveCollectionIds),
        },
      })
      toast.success("Organization updated successfully")
      setEditDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization")
    }
  }

  const handleDeleteOrg = async () => {
    if (!selectedOrg) return
    if (!canDeleteOrg || !canManageSelectedOrganization) {
      toast.error("You do not have permission to delete organizations")
      return
    }

    try {
      await deleteOrg.mutateAsync(selectedOrg.id)
      toast.success("Organization deleted successfully")
      setDeleteDialogOpen(false)
      setSelectedOrg(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete organization")
    }
  }

  const handleOpenAddMemberDialog = async () => {
    if (!selectedOrg) return

    if (!canManageMembers || !canManageSelectedOrganization) {
      toast.error("You do not have permission to invite members")
      return
    }

    setUsersLoading(true)
    try {
      const candidates = await organizationService.listMemberCandidates(selectedOrg.id, { limit: 100 })
      setAvailableUsers(candidates)
    } catch {
      toast.error("Failed to load users")
    } finally {
      setUsersLoading(false)
    }
    setAddMemberDialogOpen(true)
  }

  const handleAddMember = async () => {
    if (!selectedOrg || !addMemberData.userId) return
    if (!canManageMembers || !canManageSelectedOrganization) {
      toast.error("You do not have permission to invite members")
      return
    }

    try {
      await addMember.mutateAsync({
        organizationId: selectedOrg.id,
        userId: addMemberData.userId,
        role: addMemberData.role,
      })
      toast.success("Member added successfully")
      setAddMemberDialogOpen(false)
      setAddMemberData({ userId: "", role: "member" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add member")
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedOrg || !selectedMember) return
    if (!canManageMembers || !canManageSelectedOrganization) {
      toast.error("You do not have permission to remove members")
      return
    }

    try {
      await removeMember.mutateAsync({
        organizationId: selectedOrg.id,
        memberId: selectedMember.id,
      })
      toast.success("Member removed successfully")
      setRemoveMemberDialogOpen(false)
      setSelectedMember(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member")
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!selectedOrg) return
    if (!canManageMembers || !canManageSelectedOrganization) {
      toast.error("You do not have permission to update member roles")
      return
    }

    try {
      await updateMemberRole.mutateAsync({
        organizationId: selectedOrg.id,
        memberId,
        role: newRole,
      })
      toast.success("Role updated successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    }
  }

  const openEditDialog = (org: Organization) => {
    setEditOrgData({
      name: org.name,
      slug: org.slug,
      allowedAirweaveCollectionIds: readOrganizationAllowedCollectionIds(org.metadata),
    })
    setEditDialogOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage organizations and their members</p>
        </div>
        {canCreateOrg && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organizations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Organizations ({total})</CardTitle>
            <CardDescription>Select an organization to manage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {orgsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : organizations?.length ? (
                organizations.map((org: Organization) => (
                  <div
                    key={org.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleSelectOrganization(org)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void handleSelectOrganization(org) }}
                    className={`flex items-center gap-3 w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                      selectedOrg?.id === org.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={org.logo ?? undefined} alt={org.name} />
                      <AvatarFallback>{org.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate">{org.name}</span>
                      <span className="text-sm text-muted-foreground truncate">/{org.slug}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <IconDotsVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdateOrg && canManageOrganizationFromPage(org.id) && (
                          <DropdownMenuItem onClick={() => openEditDialog(org)}>
                            <IconEdit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canUpdateOrg && canDeleteOrg && canManageOrganizationFromPage(org.id) && <DropdownMenuSeparator />}
                        {canDeleteOrg && canManageOrganizationFromPage(org.id) && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedOrg(org)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <IconTrash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No organizations yet
                </div>
              )}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Details */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {selectedOrg ? selectedOrg.name : "Organization Details"}
              </CardTitle>
              <CardDescription>
                {selectedOrg ? `Manage members` : "Select an organization"}
              </CardDescription>
            </div>
            {selectedOrg && canManageMembers && canManageSelectedOrganization && (
              <Button onClick={handleOpenAddMemberDialog}>
                <IconUsers className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedOrg ? (
              <div className="text-center py-12 text-muted-foreground">
                Select an organization from the list to view details
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium text-muted-foreground">Airweave collections allowlist</div>
                  {selectedOrgAllowedCollections.length === 0 ? (
                    <div className="mt-1 text-sm text-muted-foreground">
                      No collections allowed. Members cannot attach any Airweave collection to projects.
                    </div>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {selectedOrgAllowedCollections.map((c) => (
                        <li
                          key={c.readableId}
                          className="inline-flex items-center rounded-md border px-2 py-1 text-xs"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-muted-foreground">{c.readableId}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Members Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <IconUsers className="h-5 w-5" />
                    Members ({members.length})
                  </h3>
                  {!canManageSelectedOrganization && (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      Switch your active organization to manage members for this organization
                    </div>
                  )}
                  {membersLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : members.length ? (
                    <div className="rounded-lg border">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 font-medium">Member</th>
                            <th className="text-left p-3 font-medium">Role</th>
                            <th className="text-right p-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => (
                            <tr key={member.id} className="border-t">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={member.user?.image} />
                                    <AvatarFallback>
                                      {member.user?.name?.charAt(0)?.toUpperCase() || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{member.user?.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {member.user?.email}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                {(() => {
                                  const isAdmin = member.role === "admin"
                                  const isOnlyAdmin = isAdmin && members.filter(m => m.role === "admin").length === 1
                                  const isRoleChangeDisabled = (!isSuperadmin && isOnlyAdmin) || !canManageMembers || !canManageSelectedOrganization
                                  const assignable = dedupeRoleNames(orgRolesMeta?.assignableRoles ?? [])
                                  const allRoleOptions = dedupeRoleNames(
                                    assignable.includes(member.role)
                                      ? assignable
                                      : [member.role, ...assignable],
                                  )
                                  return (
                                    <Select
                                      value={member.role || undefined}
                                      onValueChange={(value) => {
                                        if (value) void handleUpdateRole(member.id, value)
                                      }}
                                      disabled={isRoleChangeDisabled}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {allRoleOptions.map((roleName) => {
                                          const role = roleMetadataByName.get(roleName)
                                          return (
                                            <SelectItem key={roleName} value={roleName}>
                                              {role?.displayName || roleName.charAt(0).toUpperCase() + roleName.slice(1)}
                                            </SelectItem>
                                          )
                                        })}
                                      </SelectContent>
                                    </Select>
                                  )
                                })()}
                              </td>
                              <td className="p-3 text-right">
                                {canManageMembers && canManageSelectedOrganization && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setSelectedMember(member)
                                      setRemoveMemberDialogOpen(true)
                                    }}
                                  >
                                    <IconTrash className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      No members yet
                    </div>
                  )}
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Create a new organization.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={newOrgData.name}
                onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                placeholder="My Organization"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-slug">Slug</Label>
              <div className="relative">
                <Input
                  id="org-slug"
                  value={newOrgData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-organization"
                  className={slugStatus === "taken" ? "border-destructive" : slugStatus === "available" ? "border-green-500" : ""}
                />
                {slugStatus === "checking" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Checking...
                  </span>
                )}
                {slugStatus === "available" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-green-600">
                    ✓ Available
                  </span>
                )}
                {slugStatus === "taken" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-destructive">
                    ✗ Taken
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                URL: /{newOrgData.slug || "my-organization"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-airweave-collection">Airweave collections allowlist</Label>
              <MultiSelectCombobox
                id="org-airweave-collection"
                options={collectionOptions}
                value={newOrgData.allowedAirweaveCollectionIds}
                onChange={(next) => setNewOrgData({ ...newOrgData, allowedAirweaveCollectionIds: next })}
                placeholder={collectionsLoading ? "Loading collections…" : "Select collections"}
                emptyMessage="No collections available"
                disabled={!canReadCollections || collectionsLoading}
                data-testid="org-airweave-allowlist-create"
              />
              <p className="text-sm text-muted-foreground">
                {collectionsError instanceof Error
                  ? collectionsError.message
                  : !canReadCollections
                    ? "You need project read access to browse available collections."
                    : newOrgData.allowedAirweaveCollectionIds.length > 0
                      ? `Members can attach ${newOrgData.allowedAirweaveCollectionIds.length} collection${newOrgData.allowedAirweaveCollectionIds.length === 1 ? "" : "s"} to their projects.`
                      : "Leave empty to block Airweave sources for this organization."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOrg} 
              disabled={createOrg.isPending || slugStatus === "taken" || slugStatus === "checking"}
            >
              {createOrg.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update organization details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-org-name">Name</Label>
              <Input
                id="edit-org-name"
                value={editOrgData.name}
                onChange={(e) => setEditOrgData({ ...editOrgData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-org-slug">Slug</Label>
              <Input
                id="edit-org-slug"
                value={editOrgData.slug}
                onChange={(e) => setEditOrgData({ ...editOrgData, slug: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-org-airweave-collection">Airweave collections allowlist</Label>
              <MultiSelectCombobox
                id="edit-org-airweave-collection"
                options={[
                  ...collectionOptions,
                  ...editOrgData.allowedAirweaveCollectionIds
                    .filter((id) => !collectionOptions.some((o) => o.value === id))
                    .map((id) => ({ value: id, label: `${id} (not visible)`, description: id })),
                ]}
                value={editOrgData.allowedAirweaveCollectionIds}
                onChange={(next) => setEditOrgData({ ...editOrgData, allowedAirweaveCollectionIds: next })}
                placeholder={collectionsLoading ? "Loading collections…" : "Select collections"}
                emptyMessage="No collections available"
                disabled={!canReadCollections || collectionsLoading}
                data-testid="org-airweave-allowlist-edit"
              />
              <p className="text-sm text-muted-foreground">
                {collectionsError instanceof Error
                  ? collectionsError.message
                  : !canReadCollections
                    ? "You need project read access to browse available collections."
                    : editOrgData.allowedAirweaveCollectionIds.length > 0
                      ? `Members can attach ${editOrgData.allowedAirweaveCollectionIds.length} collection${editOrgData.allowedAirweaveCollectionIds.length === 1 ? "" : "s"} to their projects.`
                      : "Leave empty to block Airweave sources for this organization."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOrg} disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedOrg?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrg} disabled={deleteOrg.isPending}>
              {deleteOrg.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Add an existing user to {selectedOrg?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-member-user">User</Label>
              <Select
                value={addMemberData.userId || undefined}
                onValueChange={(value) => setAddMemberData({ ...addMemberData, userId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Loading users..." : "Select a user"} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                  {availableUsers.length === 0 && !usersLoading && (
                    <SelectItem value="__no_users__" disabled>No users available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-member-role">Role</Label>
              <Select
                value={addMemberData.role || undefined}
                onValueChange={(value) => setAddMemberData({ ...addMemberData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {dedupeRoleNames(orgRolesMeta?.assignableRoles ?? []).map((roleName) => {
                    const role = roleMetadataByName.get(roleName)
                    return (
                      <SelectItem key={roleName} value={roleName}>
                        {role?.displayName || roleName}
                      </SelectItem>
                    )
                  }) || <SelectItem value="__loading__" disabled>Loading...</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={addMember.isPending || !addMemberData.userId}>
              {addMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.user?.name} from {selectedOrg?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={removeMember.isPending}>
              {removeMember.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
