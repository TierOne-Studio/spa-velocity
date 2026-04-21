import { useState, useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import {
  IconDotsVertical,
  IconBan,
  IconCheck,
  IconKey,
  IconShield,
  IconTrash,
  IconUserScan,
  IconPlus,
  IconEdit,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { ServerDataTable } from "@/shared/components/ui/server-data-table"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { SystemViewBanner } from "@/shared/components/SystemViewBanner"
import { ViewingScopePicker } from "@/shared/components/ViewingScopePicker"
import { OrgTargetField } from "@/shared/components/forms/OrgTargetField"
import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities"
import { useOrgScope } from "@/shared/hooks/useOrgScope"

import {
  useUsers,
  useUserCapabilitiesBatch,
  useCreateUser,
  useUpdateUser,
  useBanUser,
  useUnbanUser,
  useSetUserRole,
  useSetUserPassword,
  useRemoveUser,
  useRemoveUsers,
  useImpersonateUser,
  usePendingUsers,
  useApproveUser,
  useRejectUser,
} from "../hooks/useUsers"
import { useOrganizations } from "../hooks/useOrganizations"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { useAuth } from "@/shared/context/AuthContext"
import { usePermissionsContext } from "@/shared/context/PermissionsContext"
import type { AdminUser, AdminUserMembership, UserFilterParams } from "../types"
import { adminService, type UserCapabilities } from "../services/adminService"

const EMPTY_USER_ACTIONS: UserCapabilities["actions"] = {
  update: false,
  setRole: false,
  ban: false,
  unban: false,
  setPassword: false,
  remove: false,
  revokeSessions: false,
  impersonate: false,
  approve: false,
  reject: false,
}

const MEMBERSHIP_PILL_LIMIT = 1
type ManagedUserRole = 'admin' | 'manager' | 'member'

function getMembershipLabel(membership: AdminUserMembership) {
  return `${membership.organizationName} · ${membership.roleDisplayName ?? membership.roleName}`
}

function getMemberships(user: AdminUser) {
  const seen = new Set<string>()
  return (user.memberships ?? []).filter((membership) => {
    const key = `${membership.organizationId}:${membership.roleName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function UsersPage() {
  // Pagination and filter state
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [searchValue, setSearchValue] = useState("")
  // Sorting state - prepared for future use
  const [sortBy] = useState<string | undefined>()
  const [sortDirection] = useState<"asc" | "desc" | undefined>()

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<AdminUser[]>([])

  // Form states
  const [newUserData, setNewUserData] = useState<{ name: string; email: string; password: string; role: 'admin' | 'manager' | 'member'; organizationId?: string }>({ name: "", email: "", password: "", role: "member" })
  const [editUserData, setEditUserData] = useState({ name: "" })
  const [banReason, setBanReason] = useState("")
  const [newRole, setNewRole] = useState("member")
  const [newPassword, setNewPassword] = useState("")

  const [createMeta, setCreateMeta] = useState<null | {
    roles: Array<{ name: string; displayName: string }>
    allowedRoleNames: Array<'admin' | 'manager' | 'member'>
    organizations: Array<{ id: string; name: string; slug: string }>
  }>(null)

  // Metadata for role change dialog (fetched from backend)
  const [roleChangeMeta, setRoleChangeMeta] = useState<null | {
    roles: Array<{ name: string; displayName: string }>
    allowedRoleNames: Array<'admin' | 'manager' | 'member'>
  }>(null)

  // Auth context
  const { user: currentUser } = useAuth()
  const { can } = usePermissionsContext()
  const { isSuperadmin, activeOrganizationId } = useOrgCapabilities()
  const scope = useOrgScope()
  const { data: organizationsResponse } = useOrganizations(
    { page: 1, limit: 100 },
    { enabled: isSuperadmin },
  )
  const organizations = organizationsResponse?.data ?? []
  const filteredOrganizationId = isSuperadmin
    ? scope.mode === "all"
      ? undefined
      : scope.organizationId ?? undefined
    : activeOrganizationId ?? undefined
  const isAllOrganizationsMode = isSuperadmin && scope.mode === "all"

  // Build query params
  const queryParams: UserFilterParams = useMemo(() => ({
    limit: pageSize,
    offset: pageIndex * pageSize,
    sortBy,
    sortDirection,
    searchValue: searchValue || undefined,
    organizationId: filteredOrganizationId,
    searchField: searchValue ? "name" : undefined,
    searchOperator: searchValue ? "contains" : undefined,
  }), [pageSize, pageIndex, sortBy, sortDirection, searchValue, filteredOrganizationId])

  // DB-backed permission flags
  const canCreateUser = can('user', 'create')
  const canUpdateUser = can('user', 'update')
  const canSetRole = can('user', 'set-role')
  const canBanUser = can('user', 'ban')
  const canSetPassword = can('user', 'set-password')
  const canDeleteUser = can('user', 'delete')
  const canImpersonate = can('user', 'impersonate')
  const canApproveUser = can('user', 'approve')

  // Pending approvals tab state
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")

  // Queries and mutations
  const { data, isLoading } = useUsers({ ...queryParams, enabled: activeTab === 'all' })
  const pendingQueryParams = activeTab === 'pending'
    ? { limit: pageSize, offset: pageIndex * pageSize, searchValue: searchValue || undefined }
    : { limit: 1, offset: 0 }
  const { data: pendingData, isLoading: pendingLoading } = usePendingUsers({
    ...pendingQueryParams,
    enabled: canApproveUser,
  })
  const users = data?.data ?? []

  const userIds = useMemo(() => users.map((u) => u.id), [users])
  const { data: batchCapabilities } = useUserCapabilitiesBatch(userIds, !!currentUser)

  const capabilitiesByUserId = useMemo<Record<string, UserCapabilities["actions"]>>(() => {
    return Object.fromEntries(
      users.map((user) => {
        return [user.id, batchCapabilities?.[user.id]?.actions ?? EMPTY_USER_ACTIONS]
      })
    )
  }, [users, batchCapabilities])

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const banUser = useBanUser()
  const unbanUser = useUnbanUser()
  const setUserRole = useSetUserRole()
  const setUserPassword = useSetUserPassword()
  const removeUser = useRemoveUser()
  const removeUsers = useRemoveUsers()
  const impersonateUser = useImpersonateUser()
  const approveUser = useApproveUser()
  const rejectUser = useRejectUser()

  // Approval handlers
  const handleApproveUser = async () => {
    if (!selectedUser) return
    try {
      await approveUser.mutateAsync(selectedUser.id)
      toast.success(`${selectedUser.name} has been approved`)
      setApproveDialogOpen(false)
      setSelectedUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve user")
    }
  }

  const handleRejectUser = async () => {
    if (!selectedUser) return
    try {
      await rejectUser.mutateAsync({
        userId: selectedUser.id,
        rejectionReason: rejectionReason || undefined,
      })
      toast.success(`${selectedUser.name} has been rejected`)
      setRejectDialogOpen(false)
      setRejectionReason("")
      setSelectedUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject user")
    }
  }

  // Handlers
  const handleCreateUser = async () => {
    try {
      if (!newUserData.organizationId) {
        toast.error("Organization is required for organization-scoped users")
        return
      }
      await createUser.mutateAsync({
        name: newUserData.name,
        email: newUserData.email,
        password: newUserData.password,
        role: newUserData.role,
        organizationId: newUserData.organizationId,
      })
      toast.success("User created successfully")
      setCreateDialogOpen(false)
      setNewUserData({ name: "", email: "", password: "", role: "member" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    }
  }

  const handleOpenCreateDialog = async (open: boolean) => {
    setCreateDialogOpen(open)
    if (!open) return
    try {
      const meta = await adminService.getCreateUserMetadata()
      setCreateMeta(meta)
      const defaultRole = meta.allowedRoleNames.includes("member") ? "member" : meta.allowedRoleNames[0]
      const defaultOrgId = meta.organizations[0]?.id
      setNewUserData({ name: "", email: "", password: "", role: defaultRole, organizationId: defaultOrgId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load user creation metadata")
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return
    try {
      await updateUser.mutateAsync({
        userId: selectedUser.id,
        data: { name: editUserData.name },
      })
      toast.success("User updated successfully")
      setEditDialogOpen(false)
      setEditUserData({ name: "" })
      setSelectedUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user")
    }
  }

  const handleBanUser = async () => {
    if (!selectedUser) return
    try {
      await banUser.mutateAsync({ userId: selectedUser.id, banReason })
      toast.success("User banned successfully")
      setBanDialogOpen(false)
      setBanReason("")
      setSelectedUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to ban user")
    }
  }

  const handleUnbanUser = async (user: AdminUser) => {
    try {
      await unbanUser.mutateAsync(user.id)
      toast.success("User unbanned successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unban user")
    }
  }

  const handleSetRole = async () => {
    if (!selectedUser) return
    try {
      await setUserRole.mutateAsync({ userId: selectedUser.id, role: newRole })
      toast.success("Role updated successfully")
      setRoleDialogOpen(false)
      setNewRole("member")
      setSelectedUser(null)
      setRoleChangeMeta(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    }
  }

  const handleOpenRoleDialog = async (user: AdminUser) => {
    setSelectedUser(user)
    setNewRole(user.role || "member")
    setRoleDialogOpen(true)
    try {
      const meta = await adminService.getCreateUserMetadata()
      setRoleChangeMeta({
        roles: meta.roles,
        allowedRoleNames: meta.allowedRoleNames,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load role options")
    }
  }

  const handleSetPassword = async () => {
    if (!selectedUser) return
    try {
      await setUserPassword.mutateAsync({ userId: selectedUser.id, newPassword })
      toast.success("Password updated successfully")
      setPasswordDialogOpen(false)
      setNewPassword("")
      setSelectedUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password")
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    try {
      await removeUser.mutateAsync(selectedUser.id)
      toast.success("User deleted successfully")
      setDeleteDialogOpen(false)
      setSelectedUser(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user")
    }
  }

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.length === 0) return
    try {
      const userIds = selectedUsers.map((u) => u.id)
      await removeUsers.mutateAsync(userIds)
      toast.success(`${selectedUsers.length} user(s) deleted successfully`)
      setBulkDeleteDialogOpen(false)
      setSelectedUsers([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete users")
    }
  }

  const handleImpersonateUser = async (user: AdminUser) => {
    // Don't allow impersonating yourself
    if (user.id === currentUser?.id) {
      toast.error("You cannot impersonate yourself")
      return
    }

    try {
      await impersonateUser.mutateAsync({
        userId: user.id,
        organizationId: filteredOrganizationId,
      })
      toast.success(`Now impersonating ${user.name}`)
      window.location.href = "/" // Redirect to dashboard
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to impersonate user")
    }
  }

  // Table columns
  const columns: ColumnDef<AdminUser>[] = useMemo(() => {
    const membershipOrRoleColumn: ColumnDef<AdminUser> = isAllOrganizationsMode
      ? {
          id: "memberships",
          header: "Memberships",
          cell: ({ row }) => {
            const memberships = getMemberships(row.original)
            const visibleMemberships = memberships.slice(0, MEMBERSHIP_PILL_LIMIT)
            const hiddenMemberships = memberships.slice(MEMBERSHIP_PILL_LIMIT)

            if (memberships.length === 0) {
              return <Badge variant="outline">No memberships</Badge>
            }

            return (
              <div className="flex flex-wrap items-center gap-2">
                {visibleMemberships.map((membership) => (
                  <Badge key={`${membership.organizationId}:${membership.roleName}`} variant="secondary">
                    {getMembershipLabel(membership)}
                  </Badge>
                ))}
                {hiddenMemberships.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        +{hiddenMemberships.length} more
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {hiddenMemberships.map((membership) => (
                        <DropdownMenuItem key={`${membership.organizationId}:${membership.roleName}`}>
                          {getMembershipLabel(membership)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          },
        }
      : {
          accessorKey: "role",
          header: "Role",
          cell: ({ row }) => {
            const role = row.original.role || "member"
            return (
              <Badge variant={role === "admin" ? "default" : "secondary"}>
                {role}
              </Badge>
            )
          },
        }

    return [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image} alt={user.name} />
                <AvatarFallback>{user.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-sm text-muted-foreground">{user.email}</span>
              </div>
            </div>
          )
        },
      },
      membershipOrRoleColumn,
      {
      accessorKey: "emailVerified",
      header: "Email Verified",
      cell: ({ row }) => (
        <Badge variant={row.original.emailVerified ? "default" : "outline"}>
          {row.original.emailVerified ? "Verified" : "Pending"}
        </Badge>
      ),
    },
      {
      accessorKey: "banned",
      header: "Status",
      cell: ({ row }) => {
        const user = row.original
        if (user.approvalStatus === "pending") {
          return (
            <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
              Pending Approval
            </Badge>
          )
        }
        if (user.approvalStatus === "rejected") {
          return (
            <Badge variant="destructive" className="gap-1">
              Rejected
            </Badge>
          )
        }
        if (user.banned) {
          return (
            <Badge variant="destructive" className="gap-1">
              <IconBan className="h-3 w-3" />
              Banned
            </Badge>
          )
        }
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
            <IconCheck className="h-3 w-3" />
            Active
          </Badge>
        )
      },
    },
      {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return date.toLocaleDateString()
      },
      },
      {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original
        const actions = capabilitiesByUserId[user.id] ?? EMPTY_USER_ACTIONS

        const canUpdate = actions.update && canUpdateUser
        const canDoSetRole = actions.setRole && canSetRole
        const canDoSetPassword = actions.setPassword && canSetPassword
        const canBan = actions.ban && canBanUser
        const canUnban = actions.unban && canBanUser
        const canRemove = actions.remove && canDeleteUser
        const canDoImpersonate = actions.impersonate && canImpersonate
        const canDoApprove = actions.approve && canApproveUser && user.approvalStatus === 'pending'
        const canDoReject = actions.reject && canApproveUser && user.approvalStatus === 'pending'
        const hasAnyAction =
          canUpdate ||
          canDoSetRole ||
          canDoSetPassword ||
          canBan ||
          canUnban ||
          canRemove ||
          canDoImpersonate ||
          canDoApprove ||
          canDoReject

        if (!hasAnyAction) return null

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <IconDotsVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDoApprove && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser(user)
                    setApproveDialogOpen(true)
                  }}
                >
                  <IconCheck className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
              )}
              {canDoReject && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setSelectedUser(user)
                    setRejectDialogOpen(true)
                  }}
                >
                  <IconBan className="mr-2 h-4 w-4" />
                  Reject
                </DropdownMenuItem>
              )}
              {(canDoApprove || canDoReject) && (canUpdate || canDoSetRole || canDoSetPassword || canBan || canUnban || canRemove || canDoImpersonate) && (
                <DropdownMenuSeparator />
              )}
              {canUpdate && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser(user)
                    setEditUserData({ name: user.name || "" })
                    setEditDialogOpen(true)
                  }}
                >
                  <IconEdit className="mr-2 h-4 w-4" />
                  Edit User
                </DropdownMenuItem>
              )}
              {canDoSetPassword && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser(user)
                    setPasswordDialogOpen(true)
                  }}
                >
                  <IconKey className="mr-2 h-4 w-4" />
                  Reset Password
                </DropdownMenuItem>
              )}
              {(canDoSetRole || canDoImpersonate || canBan || canUnban || canRemove) && (
                <>
                  {canDoSetRole && (
                    <DropdownMenuItem
                      onClick={() => handleOpenRoleDialog(user)}
                    >
                      <IconShield className="mr-2 h-4 w-4" />
                      Change Role
                    </DropdownMenuItem>
                  )}
                  {canDoImpersonate && (
                    <DropdownMenuItem
                      onClick={() => handleImpersonateUser(user)}
                    >
                      <IconUserScan className="mr-2 h-4 w-4" />
                      Impersonate User
                    </DropdownMenuItem>
                  )}
                  {(canBan || canUnban) && <DropdownMenuSeparator />}
                  {user.banned ? (
                    canUnban && (
                      <DropdownMenuItem onClick={() => handleUnbanUser(user)}>
                        <IconCheck className="mr-2 h-4 w-4" />
                        Unban User
                      </DropdownMenuItem>
                    )
                  ) : (
                    canBan && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user)
                          setBanDialogOpen(true)
                        }}
                      >
                        <IconBan className="mr-2 h-4 w-4" />
                        Ban User
                      </DropdownMenuItem>
                    )
                  )}
                  {canRemove && <DropdownMenuSeparator />}
                  {canRemove && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setSelectedUser(user)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      Delete User
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      },
    ]
  }, [
    currentUser,
    capabilitiesByUserId,
    canUpdateUser,
    canSetRole,
    canBanUser,
    canSetPassword,
    canDeleteUser,
    canImpersonate,
    canApproveUser,
    isAllOrganizationsMode,
    handleOpenRoleDialog,
    handleImpersonateUser,
    handleUnbanUser,
  ])

  // Determine which data to show based on active tab
  const displayUsers = activeTab === 'pending' ? (pendingData?.data ?? []) : users
  const displayTotal = activeTab === 'pending' ? (pendingData?.total ?? 0) : (data?.total ?? 0)
  const displayLoading = activeTab === 'pending' ? pendingLoading : isLoading

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <SystemViewBanner visible={isSuperadmin && scope.mode === "all"} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
      </div>

      {canApproveUser && (
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveTab('all'); setPageIndex(0) }}
          >
            All Users
          </Button>
          <Button
            variant={activeTab === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveTab('pending'); setPageIndex(0) }}
          >
            Pending Approvals
            {(pendingData?.total ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingData?.total}
              </Badge>
            )}
          </Button>
        </div>
      )}

      <ServerDataTable
        columns={columns}
        data={displayUsers}
        total={displayTotal}
        pageSize={pageSize}
        pageIndex={pageIndex}
        isLoading={displayLoading}
        searchPlaceholder="Search users..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onPageChange={setPageIndex}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPageIndex(0)
        }}
        enableRowSelection
        getRowId={(row) => row.id}
        onRowSelectionChange={setSelectedUsers}
        toolbar={
          <div className="flex items-center gap-2">
            <ViewingScopePicker
              value={scope.selectedValue}
              onChange={(value) => {
                scope.setSelectedValue(value)
                setPageIndex(0)
              }}
              organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
              className="w-[220px]"
              placeholder="All organizations"
            />
            {selectedUsers.length > 0 && canDeleteUser && (
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete ({selectedUsers.length})
              </Button>
            )}
            {canCreateUser && (
              <Button onClick={() => handleOpenCreateDialog(true)}>
                <IconPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            )}
          </div>
        }
      />

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={handleOpenCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the system.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newUserData.name}
                onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUserData.role}
                onValueChange={(value) =>
                  setNewUserData({ ...newUserData, role: value as ManagedUserRole })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {(createMeta?.allowedRoleNames ?? ["member"]).map((roleName) => {
                    const label = createMeta?.roles.find((r) => r.name === roleName)?.displayName ?? roleName
                    return (
                      <SelectItem key={roleName} value={roleName}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <OrgTargetField
              value={newUserData.organizationId ?? null}
              onChange={(id) => setNewUserData({ ...newUserData, organizationId: id })}
              organizations={createMeta?.organizations ?? []}
              testId="user-organization"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information for {selectedUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Ban {selectedUser?.name} from accessing the system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="banReason">Reason (optional)</Label>
              <Input
                id="banReason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBanUser} disabled={banUser.isPending}>
              {banUser.isPending ? "Banning..." : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(open) => {
        setRoleDialogOpen(open)
        if (!open) setRoleChangeMeta(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newRole">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleChangeMeta ? (
                    roleChangeMeta.allowedRoleNames.map((roleName) => {
                      const roleInfo = roleChangeMeta.roles.find((r) => r.name === roleName)
                      return (
                        <SelectItem key={roleName} value={roleName}>
                          {roleInfo?.displayName ?? roleName}
                        </SelectItem>
                      )
                    })
                  ) : (
                    <SelectItem value="member" disabled>Loading...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetRole} disabled={setUserRole.isPending || !roleChangeMeta}>
              {setUserRole.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={setUserPassword.isPending}>
              {setUserPassword.isPending ? "Updating..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={removeUser.isPending}>
              {removeUser.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Users Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedUsers.length} User(s)</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUsers.length} selected user(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteUsers} disabled={removeUsers.isPending}>
              {removeUsers.isPending ? "Deleting..." : `Delete ${selectedUsers.length} User(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve User Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve User</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve {selectedUser?.name} ({selectedUser?.email})? They will be able to access the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveUser} disabled={approveUser.isPending}>
              {approveUser.isPending ? "Approving..." : "Approve User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject User Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User</DialogTitle>
            <DialogDescription>
              Reject the registration for {selectedUser?.name} ({selectedUser?.email}). They will not be able to access the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rejectionReason">Reason (optional)</Label>
              <Input
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectUser} disabled={rejectUser.isPending}>
              {rejectUser.isPending ? "Rejecting..." : "Reject User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
