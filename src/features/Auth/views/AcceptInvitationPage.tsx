import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card"
import { Button } from "@shared/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { organizationService, adminService } from "@features/Admin/services/adminService"
import { useAuth } from "@shared/context/AuthContext"
import { toast } from "sonner"

type Status = "loading" | "success" | "error" | "not-authenticated"

export function AcceptInvitationPage() {
  const { invitationId } = useParams<{ invitationId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [status, setStatus] = useState<Status>("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const hasAttemptedAcceptance = useRef(false)

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return

    // Check authentication first
    if (!isAuthenticated) {
      setStatus("not-authenticated")
      return
    }

    // Prevent duplicate acceptance attempts
    if (hasAttemptedAcceptance.current) return
    hasAttemptedAcceptance.current = true

    const acceptInvitation = async () => {
      if (!invitationId) {
        setStatus("error")
        setErrorMessage("Invalid invitation link")
        return
      }

      try {
        console.log("Accepting invitation:", invitationId)
        await organizationService.acceptInvitation(invitationId)
        console.log("Invitation accepted successfully")

        // Auto-approve invited users — the invitation itself is the approval
        try {
          await adminService.selfApproveInvited()
        } catch {
          // Non-critical: user may already be approved or endpoint may not exist yet
        }

        toast.success("Invitation accepted! You are now a member of the organization.")
        setStatus("success")
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate("/")
        }, 2000)
      } catch (error) {
        console.error("Failed to accept invitation:", error)
        const message = error instanceof Error ? error.message : "Failed to accept invitation"
        toast.error(message)
        setStatus("error")
        setErrorMessage(message)
      }
    }

    acceptInvitation()
  }, [invitationId, navigate, isAuthenticated, authLoading])

  const handleLoginRedirect = () => {
    // Store invitation ID to accept after login
    sessionStorage.setItem("pendingInvitationId", invitationId || "")
    navigate("/login")
  }

  const handleSignupRedirect = () => {
    // Store invitation ID to accept after signup
    sessionStorage.setItem("pendingInvitationId", invitationId || "")
    navigate("/signup")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Organization Invitation</CardTitle>
          <CardDescription>
            {status === "loading" && "Processing your invitation..."}
            {status === "success" && "Welcome to the organization!"}
            {status === "error" && "Something went wrong"}
            {status === "not-authenticated" && "Please sign in to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center text-muted-foreground">
                You have successfully joined the organization. Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground">{errorMessage}</p>
              <Button onClick={() => navigate("/")} variant="outline">
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "not-authenticated" && (
            <>
              <p className="text-center text-muted-foreground">
                You need to sign in or create an account to accept this invitation.
              </p>
              <div className="flex gap-2 w-full">
                <Button onClick={handleLoginRedirect} className="flex-1">
                  Sign In
                </Button>
                <Button onClick={handleSignupRedirect} variant="outline" className="flex-1">
                  Sign Up
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
