import { useState, useEffect, useCallback } from "react"
import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconLogout,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Skeleton } from "@/shared/components/ui/skeleton"

import { useQueryClient } from "@tanstack/react-query"
import { organization } from "@/shared/lib/auth-client"
import { usePermissionsContext } from "@/shared/context/PermissionsContext"
import { useAuth } from "@/shared/context/AuthContext"
import { organizationService } from "@/features/Admin/services/adminService"

interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
}

export function OrganizationSwitcher() {
  const { can } = usePermissionsContext()
  const { isAdmin, refreshSession } = useAuth()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newOrgData, setNewOrgData] = useState({ name: "", slug: "" })
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeMember, setActiveMember] = useState<{ organizationId?: string } | null>(null)
  const [orgsLoading, setOrgsLoading] = useState(true)
  const canCreateOrganization = can("organization", "create")

  // Refresh session + invalidate all cached queries after org change.
  // Replaces window.location.reload() to avoid full-page flicker.
  const refreshAfterOrgChange = useCallback(async () => {
    await refreshSession()
    await queryClient.invalidateQueries()
  }, [refreshSession, queryClient])

  // Fetch organizations using Better Auth client
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch orgs first; getActiveMember may fail if no org is active
        const orgsResult = await organization.list()
        const orgs = (orgsResult.data ?? []) as Organization[]
        setOrganizations(orgs)

        let member: { organizationId?: string } | null = null
        try {
          const memberResult = await organization.getActiveMember()
          member = memberResult.data as { organizationId?: string } | null
        } catch {
          // No active org — expected for new users
        }
        setActiveMember(member)

        // Auto-activate first org if user has orgs but none is active
        if (orgs.length > 0 && !member?.organizationId) {
          try {
            await organization.setActive({ organizationId: orgs[0].id })
            await refreshAfterOrgChange()
            return
          } catch (err) {
            console.error("Failed to auto-activate organization:", err)
          }
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error)
      } finally {
        setOrgsLoading(false)
      }
    }
    fetchData()
  }, [refreshAfterOrgChange])

  const [isLoading, setIsLoading] = useState(false)

  // Find active organization
  const activeOrg = organizations.find(
    (org) => org.id === activeMember?.organizationId
  )

  const refreshData = async () => {
    const [orgsResult, memberResult] = await Promise.all([
      organization.list(),
      organization.getActiveMember(),
    ])
    setOrganizations((orgsResult.data ?? []) as Organization[])
    setActiveMember(memberResult.data as { organizationId?: string } | null)
  }

  const handleSetActive = async (orgId: string) => {
    setIsLoading(true)
    try {
      const result = await organization.setActive({ organizationId: orgId })
      if (result.error) {
        throw new Error(result.error.message || "Failed to switch organization")
      }
      toast.success("Switched organization")
      await refreshAfterOrgChange()
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch organization")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrg = async () => {
    if (!canCreateOrganization) {
      toast.error("You do not have permission to create organizations")
      return
    }

    setIsLoading(true)
    try {
      await organizationService.createOrganization({
        name: newOrgData.name,
        slug: newOrgData.slug.toLowerCase().replace(/\s+/g, "-"),
      })
      await refreshData()
      toast.success("Organization created successfully")
      setCreateDialogOpen(false)
      setNewOrgData({ name: "", slug: "" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaveOrg = async (orgId: string) => {
    setIsLoading(true)
    try {
      await organization.leave({ organizationId: orgId })
      await refreshData()
      toast.success("Left organization")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave organization")
    } finally {
      setIsLoading(false)
    }
  }

  if (orgsLoading) {
    return <Skeleton className="h-9 w-40" />
  }

  if (!isAdmin) {
    return (
      <Button variant="outline" className="w-full justify-between" disabled>
        <div className="flex items-center gap-2">
          <IconBuilding className="h-4 w-4" />
          <span className="truncate max-w-[120px]">
            {activeOrg?.name ?? "Organization"}
          </span>
        </div>
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              <span className="truncate max-w-[120px]">
                {activeOrg?.name ?? "Select Organization"}
              </span>
            </div>
            <IconChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.length === 0 ? (
            <DropdownMenuItem disabled>
              No organizations
            </DropdownMenuItem>
          ) : (
            organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSetActive(org.id)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <IconBuilding className="h-4 w-4" />
                  <span className="truncate">{org.name}</span>
                </div>
                {activeOrg?.id === org.id && (
                  <IconCheck className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))
          )}
          {canCreateOrganization && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                <IconPlus className="mr-2 h-4 w-4" />
                Create Organization
              </DropdownMenuItem>
            </>
          )}
          {activeOrg && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleLeaveOrg(activeOrg.id)}
                className="text-destructive"
              >
                <IconLogout className="mr-2 h-4 w-4" />
                Leave {activeOrg.name}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Organization Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="orgName">Name</Label>
              <Input
                id="orgName"
                value={newOrgData.name}
                onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                placeholder="My Organization"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="orgSlug">Slug</Label>
              <Input
                id="orgSlug"
                value={newOrgData.slug}
                onChange={(e) => setNewOrgData({ ...newOrgData, slug: e.target.value })}
                placeholder="my-organization"
              />
              <p className="text-sm text-muted-foreground">
                This will be used in URLs: /org/{newOrgData.slug || "my-organization"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
