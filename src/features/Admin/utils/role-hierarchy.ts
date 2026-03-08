/**
 * Role hierarchy for determining assignable roles.
 * Higher number = higher privilege.
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  manager: 1,
  admin: 2,
};

/**
 * Returns the hierarchy level for a role name.
 * Unknown roles default to 0 (lowest).
 */
export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

 export function filterAssignableRoles(
   allRoles: string[],
   requesterRole: string,
 ): string[] {
   const requesterLevel = getRoleLevel(requesterRole);
   return allRoles.filter((role) => {
     const roleLevel = ROLE_HIERARCHY[role];
     return roleLevel !== undefined && roleLevel <= requesterLevel;
   });
 }

/**
 * Filter roles to only those visible to the given requester role.
 * A user can only view roles strictly below their own level.
 * Admin can view all roles.
 */
export function filterVisibleRoles<T extends { name: string }>(
  allRoles: T[],
  requesterRole: string,
): T[] {
  const requesterLevel = getRoleLevel(requesterRole);
  // Admin sees all roles; others see only roles strictly below their level
  if (requesterLevel >= ROLE_HIERARCHY.admin) {
    return allRoles;
  }
  return allRoles.filter((r) => {
    const roleLevel = ROLE_HIERARCHY[r.name];
    return roleLevel !== undefined && roleLevel < requesterLevel;
  });
}
