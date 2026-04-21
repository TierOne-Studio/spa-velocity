import { useEffectiveSession } from "@shared/hooks/useEffectiveSession";
import { useMyMemberships, type Membership } from "@shared/hooks/useMyMemberships";
import { getSessionUserRole, isSuperadminRole } from "@shared/utils/roles";

/**
 * Single source of truth for "which organization UI should this user see?".
 *
 * Derives the three categories we distinguish in the org-UX standardization:
 * superadmin, multi-org member, single-org member. Pages use this hook instead
 * of re-deriving role/membership-count logic inline.
 *
 * Loading semantics: `isLoading` is true until the memberships query settles.
 * During load, the booleans default to `false` and `memberOrganizations` is
 * empty — callers should gate UI behind `isLoading` if mis-classification
 * would flash the wrong dropdown.
 */
export interface OrgCapabilities {
  /** Caller is a platform superadmin. */
  isSuperadmin: boolean;
  /** Caller belongs to two or more organizations. */
  isMultiOrgMember: boolean;
  /** Caller belongs to exactly one organization. */
  isSingleOrgMember: boolean;
  /** The memberships list (empty array while loading or on error). */
  memberOrganizations: Membership[];
  /** The caller's active organization id, from session. */
  activeOrganizationId: string | null;
  /** Memberships query still pending. */
  isLoading: boolean;
}

export function useOrgCapabilities(): OrgCapabilities {
  const { data: session, isPending: isSessionPending } = useEffectiveSession();
  const {
    data: memberships,
    isLoading: isMembershipsLoading,
    isFetching,
  } = useMyMemberships();

  const role = getSessionUserRole(session ?? null);
  const isSuperadmin = isSuperadminRole(role);

  const sessionData = session?.session as
    | { activeOrganizationId?: string | null }
    | undefined;
  const activeOrganizationId = sessionData?.activeOrganizationId ?? null;

  const memberOrganizations = memberships ?? [];
  const count = memberOrganizations.length;

  const isLoading = isSessionPending || isMembershipsLoading || isFetching;

  return {
    isSuperadmin,
    isMultiOrgMember: count >= 2,
    isSingleOrgMember: count === 1,
    memberOrganizations,
    activeOrganizationId,
    isLoading,
  };
}
