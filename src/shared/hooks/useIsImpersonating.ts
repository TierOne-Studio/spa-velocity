import { useEffectiveSession } from "@shared/hooks/useEffectiveSession";

/**
 * Hook to check if the current session is an impersonation session.
 * Returns impersonation state and the original user ID (impersonatedBy).
 */
export function useIsImpersonating() {
  const { data: session } = useEffectiveSession();

  const sessionData = session?.session as { impersonatedBy?: string } | undefined;
  const impersonatedBy = sessionData?.impersonatedBy ?? null;
  const hasLocalImpersonation =
    typeof window !== "undefined" &&
    ["custom", "org"].includes(localStorage.getItem("impersonation_mode") ?? "") &&
    !!localStorage.getItem("original_bearer_token");
  const isImpersonating = !!impersonatedBy || hasLocalImpersonation;

  return {
    isImpersonating,
    impersonatedBy,
  };
}
