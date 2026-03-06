import { IconUserScan, IconX } from "@tabler/icons-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/shared/components/ui/button"
import { useStopImpersonating } from "@/features/Admin/hooks/useUsers"
import { useAuth } from "@/shared/context/AuthContext"
import { useIsImpersonating } from "@/shared/hooks/useIsImpersonating"

/**
 * Banner displayed when an admin is impersonating another user.
 * Shows the impersonated user's info and allows stopping impersonation.
 */
export function ImpersonationBanner() {
  const { user, refreshSession } = useAuth()
  const queryClient = useQueryClient()
  const stopImpersonating = useStopImpersonating()
  const { isImpersonating } = useIsImpersonating()

  const handleStopImpersonating = async () => {
    try {
      await stopImpersonating.mutateAsync()
      await refreshSession()
      await queryClient.invalidateQueries()
      toast.success("Stopped impersonating user")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop impersonating")
    }
  }

  if (!isImpersonating) {
    return null
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconUserScan className="h-4 w-4" />
        <span className="text-sm font-medium">
          You are impersonating {user?.name} ({user?.email})
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-amber-950 hover:bg-amber-600 hover:text-amber-950"
        onClick={handleStopImpersonating}
        disabled={stopImpersonating.isPending}
      >
        <IconX className="h-4 w-4 mr-1" />
        {stopImpersonating.isPending ? "Stopping..." : "Stop Impersonating"}
      </Button>
    </div>
  )
}
