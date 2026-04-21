import { useQuery } from "@tanstack/react-query";

import { fetchWithAuth } from "@shared/lib/fetch-with-auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * An organization the current caller is a member of.
 *
 * Shape mirrors what `GET /api/auth/organization/list` returns via Better Auth.
 * Additional fields are tolerated but ignored.
 */
export interface Membership {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
}

/**
 * Shared React Query key for the memberships list.
 * Exported so callers (e.g. `OrganizationSwitcher`) can invalidate.
 */
export const MY_MEMBERSHIPS_QUERY_KEY = ["auth", "organization", "list"] as const;

function readMembershipsPayload(payload: unknown): Membership[] {
  if (Array.isArray(payload)) {
    return payload as Membership[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as { data?: unknown; organizations?: unknown };
  if (Array.isArray(record.data)) {
    return record.data as Membership[];
  }

  if (Array.isArray(record.organizations)) {
    return record.organizations as Membership[];
  }

  return [];
}

/**
 * Fetch the memberships (organizations) the current caller belongs to.
 *
 * Separates the network call from the dropdown component so multiple consumers
 * (`useOrgCapabilities`, `OrganizationSwitcher`, `<OrgTargetField>`) share one
 * cache entry.
 *
 * Returns the standard React Query surface.
 */
export function useMyMemberships() {
  return useQuery<Membership[]>({
    queryKey: MY_MEMBERSHIPS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/auth/organization/list`,
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { message?: string }).message ||
            "Failed to list organizations",
        );
      }
      const payload = await response.json();
      return readMembershipsPayload(payload);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
