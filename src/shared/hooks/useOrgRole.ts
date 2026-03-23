import { useEffectiveSession } from "@shared/hooks/useEffectiveSession";

// Unified Role Model - roles that can manage organization settings
// - 'admin': Global platform administrator (can manage all orgs)
// - 'manager': Organization manager (can manage their org)
/**
 * Hook to get the current user's role in the active organization.
 * Returns org role information and helper flags.
 * 
 * Unified Role Model:
 * - 'admin': Global platform administrator
 * - 'manager': Organization manager
 * - 'member': Organization member
 */
export function useOrgRole() {
  const { data: session } = useEffectiveSession();

  const sessionData = session?.session as { 
    activeOrganizationId?: string;
  } | undefined;

  const activeOrganizationId = sessionData?.activeOrganizationId ?? null;

  // Note: The actual org member role would need to be fetched from the organization
  // membership data. For now, we'll expose the active org ID and provide a way
  // to check roles once the membership data is available.
  
  return {
    activeOrganizationId,
    isInOrganization: !!activeOrganizationId,
  };
}
