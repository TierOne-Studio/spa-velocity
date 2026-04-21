import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities";

/** A minimal org shape for rendering options — `id` and `name` are all we need. */
export interface TargetOrganization {
  id: string;
  name: string;
}

export interface OrgTargetFieldProps {
  /** Controlled value — the currently selected target organization id. */
  value: string | null;
  /** Controlled onChange — called with the new org id. */
  onChange: (organizationId: string) => void;
  /** Disable the dropdown (e.g. during submit). */
  disabled?: boolean;
  /** Label above the dropdown. Defaults to "Organization". */
  label?: string;
  /** Optional help text rendered below the dropdown. */
  helpText?: string;
  /**
   * For edit-mode flows: when the single-org branch would normally render
   * `null`, rendering a disabled read-only line instead keeps the UI balanced.
   */
  showReadOnlyFallback?: boolean;
  /** Friendly name to show in the read-only fallback. */
  readOnlyOrganizationName?: string;
  /**
   * Organizations to show for the superadmin branch. Falls back to the
   * caller's memberships if not provided.
   */
  organizations?: TargetOrganization[];
  /** Optional data-testid for e2e specs. */
  testId?: string;
  /** Optional placeholder when no value is selected. */
  placeholder?: string;
  /** Optional class override on the outer container. */
  className?: string;
}

/**
 * Form field for picking the **target organization** of a create/update flow.
 *
 * Three role branches (derived internally from `useOrgCapabilities` — parents
 * never need to branch):
 *
 *   - **Single-org member**: no dropdown rendered (the target is already
 *     unambiguous). Optionally renders a read-only fallback.
 *   - **Multi-org member**: dropdown sourced from the caller's memberships.
 *   - **Superadmin**: dropdown sourced from `organizations` prop (falls back
 *     to memberships if omitted).
 *
 * Controlled (value/onChange). Callers using `react-hook-form` wrap it in a
 * `<Controller>`.
 */
export function OrgTargetField({
  value,
  onChange,
  disabled = false,
  label = "Organization",
  helpText,
  showReadOnlyFallback = false,
  readOnlyOrganizationName,
  organizations,
  testId = "org-target-field",
  placeholder = "Select organization",
  className,
}: OrgTargetFieldProps) {
  const {
    isSuperadmin,
    isMultiOrgMember,
    isSingleOrgMember,
    memberOrganizations,
    isLoading,
  } = useOrgCapabilities();

  // Single-org member: render read-only fallback if requested, else nothing.
  if (isSingleOrgMember) {
    if (!showReadOnlyFallback) return null;

    const displayName =
      readOnlyOrganizationName ??
      memberOrganizations[0]?.name ??
      "";

    return (
      <div className={className} data-testid={testId}>
        <Label className="mb-1 block">{label}</Label>
        <div className="text-sm text-muted-foreground" aria-readonly="true">
          {displayName}
        </div>
        {helpText && (
          <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
        )}
      </div>
    );
  }

  // Choose the option list based on role. Superadmin may pass a broader list;
  // multi-org members are constrained to their memberships.
  const options: TargetOrganization[] = isSuperadmin
    ? (organizations ?? memberOrganizations)
    : isMultiOrgMember
      ? memberOrganizations
      : [];

  // If the user is neither superadmin nor multi-org (e.g. not yet loaded, or
  // an edge case with zero memberships), render nothing — parent should gate
  // on isLoading if desired.
  if (!isSuperadmin && !isMultiOrgMember) {
    return null;
  }

  return (
    <div className={className} data-testid={testId}>
      <Label className="mb-1 block">{label}</Label>
      <Select
        value={value ?? undefined}
        onValueChange={onChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger data-testid={`${testId}-trigger`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpText && (
        <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
