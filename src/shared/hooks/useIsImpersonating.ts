import { useSession } from "@shared/lib/auth-client";

/**
 * Hook to check if the current session is an impersonation session.
 * Returns impersonation state and the original user ID (impersonatedBy).
 */
export function useIsImpersonating() {
  const { data: session } = useSession();

  const sessionData = session?.session as { impersonatedBy?: string } | undefined;
  const impersonatedBy = sessionData?.impersonatedBy ?? null;
  const hasOrgScopedImpersonation =
    typeof window !== "undefined" &&
    localStorage.getItem("impersonation_mode") === "org" &&
    !!localStorage.getItem("original_bearer_token");
  const isImpersonating = !!impersonatedBy || hasOrgScopedImpersonation;

  return {
    isImpersonating,
    impersonatedBy,
  };
}
