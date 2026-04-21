import { useCallback, useMemo, useState } from "react";

import {
  ALL_ORGANIZATIONS_VALUE,
  isAllOrganizationsValue,
} from "@shared/constants/org-scope";
import { useOrgCapabilities } from "@shared/hooks/useOrgCapabilities";

/**
 * Represents the viewing-scope state of a page.
 *
 * "Viewing scope" is per-page local state (not global session state). It only
 * exists for superadmin — everyone else is pinned to their active organization.
 *
 * Shape:
 *   - `mode: "all"`   → superadmin cross-org view (backend sees `?scope=all`)
 *   - `mode: "single"`→ exactly one organization id (or active org)
 */
export type OrgScopeMode = "all" | "single";

export interface UseOrgScopeOptions {
  /**
   * Which mode to default to for superadmin. Non-superadmin always defaults to
   * their active organization regardless of this option.
   *
   * Default: `"all"` for superadmin, `"single"` for non-superadmin.
   */
  superadminDefaultMode?: OrgScopeMode;
}

export interface UseOrgScopeReturn {
  /** Current mode (derived from selected value). */
  mode: OrgScopeMode;
  /**
   * The currently selected value as consumed by a `<Select>` — either a real
   * organization id or the `__all__` sentinel.
   */
  selectedValue: string | null;
  /** Convenience accessor: the organization id when mode === "single". */
  organizationId: string | null;
  /**
   * Set the picker value. Accepts `ALL_ORGANIZATIONS_VALUE` or any org id.
   * Non-superadmin callers are ignored (scope is pinned to active org).
   */
  setSelectedValue: (value: string | null) => void;
  /**
   * Build a query object for the API.
   *
   * Contracts:
   *   mode "all"    → `{ scope: "all" }`
   *   mode "single" → `{ organizationId: <id> }` (empty if no id yet)
   */
  toQuery: () => { scope?: "all"; organizationId?: string };
}

/**
 * Page-local viewing-scope state.
 *
 * Returns the "source of truth" for any list/filter surface that needs to
 * express a viewing scope. The hook owns ONE piece of state — the selected
 * value — and derives everything else from session + memberships.
 *
 * Rules:
 *   - Non-superadmin: value is pinned to `activeOrganizationId`. Setters are
 *     no-ops; no viewing-scope control should render for them anyway.
 *   - Superadmin: caller picks. Default follows `superadminDefaultMode`.
 */
export function useOrgScope(
  options: UseOrgScopeOptions = {},
): UseOrgScopeReturn {
  const { isSuperadmin, activeOrganizationId } = useOrgCapabilities();
  const defaultMode: OrgScopeMode =
    options.superadminDefaultMode ?? (isSuperadmin ? "all" : "single");

  const initialValue: string | null = isSuperadmin
    ? defaultMode === "all"
      ? ALL_ORGANIZATIONS_VALUE
      : activeOrganizationId
    : activeOrganizationId;

  const [superadminSelection, setSuperadminSelection] = useState<string | null>(
    initialValue,
  );

  const effectiveValue: string | null = isSuperadmin
    ? superadminSelection
    : activeOrganizationId;

  const setSelectedValue = useCallback(
    (value: string | null) => {
      if (!isSuperadmin) return; // pinned to active org
      setSuperadminSelection(value);
    },
    [isSuperadmin],
  );

  return useMemo<UseOrgScopeReturn>(() => {
    const mode: OrgScopeMode = isAllOrganizationsValue(effectiveValue)
      ? "all"
      : "single";
    const organizationId =
      mode === "single" && effectiveValue !== null ? effectiveValue : null;

    const toQuery = () => {
      if (mode === "all") return { scope: "all" as const };
      return organizationId ? { organizationId } : {};
    };

    return {
      mode,
      selectedValue: effectiveValue,
      organizationId,
      setSelectedValue,
      toQuery,
    };
  }, [effectiveValue, setSelectedValue]);
}
