/**
 * Check whether a role value (string, string[], or undefined) includes "superadmin".
 * Handles comma-separated strings, arrays, null, and undefined.
 */
export function isSuperadminRole(role: string | string[] | null | undefined): boolean {
  if (Array.isArray(role)) {
    return role.includes("superadmin");
  }

  return String(role ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes("superadmin");
}

/**
 * Extract the active organization ID from a session object.
 */
export function getActiveOrganizationId(
  session: { session?: { activeOrganizationId?: string } } | null | undefined,
): string | null {
  return (session?.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ?? null;
}

/**
 * Extract the user role from a session object.
 */
export function getSessionUserRole(
  session: { user?: { role?: string | string[] } } | null | undefined,
): string | string[] | undefined {
  return (session?.user as { role?: string | string[] } | undefined)?.role;
}
