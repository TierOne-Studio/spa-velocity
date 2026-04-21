/**
 * Shared org-scope constants.
 *
 * These values are consumed by `<ViewingScopePicker>`, `useOrgScope`, and the
 * page-level migrations that previously duplicated an inline `"__all__"`
 * sentinel per page.
 *
 * Values are also used as query-string contracts against the api-velocity
 * backend (`scope=all`). See `api-velocity/src/modules/admin/users/utils/org-scope.utils.ts`.
 */

/**
 * Sentinel value used inside selects to represent "all organizations".
 * Must match the value superadmin pages use in their dropdowns.
 */
export const ALL_ORGANIZATIONS_VALUE = "__all__" as const;

/**
 * Query object sent to the backend for a cross-organization view.
 * Matches the `?scope=all` contract on api-velocity controllers.
 */
export const ORG_SCOPE_ALL_QUERY = { scope: "all" } as const;

export type AllOrganizationsValue = typeof ALL_ORGANIZATIONS_VALUE;

/**
 * Narrow a selected value against the "all" sentinel.
 */
export function isAllOrganizationsValue(value: string | null | undefined): value is AllOrganizationsValue {
  return value === ALL_ORGANIZATIONS_VALUE;
}
