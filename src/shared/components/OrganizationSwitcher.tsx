import { useState, useEffect, useCallback, useRef } from "react"
import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
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
import { Skeleton } from "@/shared/components/ui/skeleton"

import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/shared/context/AuthContext"
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession"
import { fetchWithAuth } from "@/shared/lib/fetch-with-auth"

interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

function readOrganizationsPayload(payload: unknown): Organization[] {
  if (Array.isArray(payload)) {
    return payload as Organization[]
  }

  if (!payload || typeof payload !== "object") {
    return []
  }

  const record = payload as { data?: unknown; organizations?: unknown }
  if (Array.isArray(record.data)) {
    return record.data as Organization[]
  }

  if (Array.isArray(record.organizations)) {
    return record.organizations as Organization[]
  }

  return []
}

function readActiveMemberPayload(payload: unknown): { organizationId?: string } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const record = payload as {
    data?: unknown
    member?: unknown
    organizationId?: string
  }

  const candidate =
    record.data && typeof record.data === "object"
      ? record.data
      : record.member && typeof record.member === "object"
        ? record.member
        : record

  if (!candidate || typeof candidate !== "object") {
    return null
  }

  const member = candidate as { organizationId?: string }
  return member.organizationId ? { organizationId: member.organizationId } : null
}

export function OrganizationSwitcher() {
  const { user, refreshSession } = useAuth()
  const { data: session } = useEffectiveSession()
  const queryClient = useQueryClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeMember, setActiveMember] = useState<{ organizationId?: string } | null>(null)
  const [orgsLoading, setOrgsLoading] = useState(true)
  const lastFetchedUserKeyRef = useRef<string | null>(null)
  const effectiveUser =
    (session?.user as { id?: string; role?: string | string[] } | undefined) ??
    (user as { id?: string; role?: string | string[] } | undefined)
  const effectiveRole = Array.isArray(effectiveUser?.role)
    ? effectiveUser.role[0] ?? null
    : effectiveUser?.role ?? null
  const activeOrganizationId =
    (session?.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ?? null

  // Refresh session + invalidate all cached queries after org change.
  // Replaces window.location.reload() to avoid full-page flicker.
  const refreshAfterOrgChange = useCallback(async () => {
    await refreshSession()
    await queryClient.invalidateQueries()
  }, [refreshSession, queryClient])

  const getActiveMemberSafely = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/organization/get-active-member`)
      if (!response.ok) {
        return null
      }

      const result = await response.json().catch(() => null)
      return readActiveMemberPayload(result)
    } catch {
      return null
    }
  }, [])

  const listOrganizationsViaApi = useCallback(async (): Promise<Organization[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/organization/list`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { message?: string }).message || "Failed to list organizations")
    }

    const result = await response.json()
    return readOrganizationsPayload(result)
  }, [])

  const setActiveOrganization = useCallback(async (organizationId: string) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/organization/set-active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { message?: string }).message || "Failed to switch organization")
    }
  }, [])

  // Fetch organizations using Better Auth client
  useEffect(() => {
    const userKey = effectiveUser
      ? `${effectiveUser.id ?? "unknown"}:${Array.isArray(effectiveUser.role) ? effectiveUser.role.join(",") : effectiveUser.role ?? "unknown"}`
      : null

    const shouldRefetchForActiveOrganization =
      !!activeOrganizationId && !organizations.some((org) => org.id === activeOrganizationId)

    if (lastFetchedUserKeyRef.current === userKey && !shouldRefetchForActiveOrganization) {
      return
    }

    lastFetchedUserKeyRef.current = userKey
    setOrgsLoading(true)

    const fetchData = async () => {
      try {
        const orgs = await listOrganizationsViaApi()
        setOrganizations(orgs)

        const member = await getActiveMemberSafely()
        const resolvedMember = member ?? (activeOrganizationId ? { organizationId: activeOrganizationId } : null)
        setActiveMember(resolvedMember)

        // Auto-activate only when there is a single possible org and none is active yet.
        if (orgs.length === 1 && !resolvedMember?.organizationId) {
          try {
            await setActiveOrganization(orgs[0].id)
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
  }, [activeOrganizationId, effectiveRole, effectiveUser, getActiveMemberSafely, listOrganizationsViaApi, setActiveOrganization])

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setActiveMember((current) => {
      const nextOrganizationId = activeOrganizationId ?? undefined

      if (current?.organizationId === nextOrganizationId) {
        return current
      }

      return nextOrganizationId ? { organizationId: nextOrganizationId } : null
    })
  }, [activeOrganizationId])

  // Find active organization
  const activeOrg = organizations.find(
    (org) => org.id === (activeMember?.organizationId ?? activeOrganizationId ?? undefined)
  )
  const displayedOrg = activeOrg ?? (organizations.length === 1 ? organizations[0] : null)

  const refreshData = async () => {
    const [orgs, memberResult] = await Promise.all([listOrganizationsViaApi(), getActiveMemberSafely()])
    setOrganizations(orgs)
    setActiveMember(memberResult ?? (activeOrganizationId ? { organizationId: activeOrganizationId } : null))
  }

  const handleSetActive = async (orgId: string) => {
    setIsLoading(true)
    try {
      await setActiveOrganization(orgId)
      toast.success("Switched organization")
      setActiveMember({ organizationId: orgId })
      await refreshAfterOrgChange()
      await refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch organization")
    } finally {
      setIsLoading(false)
    }
  }

  if (orgsLoading) {
    return <Skeleton className="h-9 w-40" />
  }

  const resolvedActiveOrganizationId = activeMember?.organizationId ?? activeOrganizationId ?? null
  const isOnlyVisibleOrganizationActive =
    organizations.length === 1 && organizations[0]?.id === resolvedActiveOrganizationId
  const isSelectorDisabled =
    isLoading ||
    organizations.length === 0 ||
    isOnlyVisibleOrganizationActive

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={isSelectorDisabled}
        >
          <div className="flex items-center gap-2">
            <IconBuilding className="h-4 w-4" />
            <span className="truncate max-w-[120px]">
              {displayedOrg?.name ?? (organizations.length > 0 ? "Select Organization" : "No Organization")}
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
              {displayedOrg?.id === org.id && (
                <IconCheck className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
