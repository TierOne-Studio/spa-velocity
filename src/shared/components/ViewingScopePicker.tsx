import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ALL_ORGANIZATIONS_VALUE } from "@/shared/constants/org-scope";
import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities";

/** A minimal org shape for rendering options — `id` and `name` are all we need. */
export interface PickerOrganization {
  id: string;
  name: string;
}

export interface ViewingScopePickerProps {
  /** The currently selected value (org id or the `__all__` sentinel). */
  value: string | null;
  /** Called when the user picks a different value. */
  onChange: (value: string) => void;
  /** Organizations to render in the dropdown. Typically the superadmin list. */
  organizations: PickerOrganization[];
  /**
   * Whether to render the "All organizations" option. Some contexts (like a
   * create form) forbid cross-org scope; those callers pass `false`.
   * Defaults to `true`.
   */
  includeAllOption?: boolean;
  /** Optional data-testid. */
  testId?: string;
  /** Optional class override on the trigger. */
  className?: string;
  /** Optional placeholder when no value is selected. */
  placeholder?: string;
}

/**
 * Superadmin-only viewing-scope picker.
 *
 * Returns `null` for non-superadmin callers (verified via `useOrgCapabilities`)
 * so pages can drop it in unconditionally — no branching on role.
 */
export function ViewingScopePicker({
  value,
  onChange,
  organizations,
  includeAllOption = true,
  testId = "viewing-scope-picker",
  className,
  placeholder = "Select organization",
}: ViewingScopePickerProps) {
  const { isSuperadmin } = useOrgCapabilities();

  if (!isSuperadmin) {
    return null;
  }

  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && (
          <SelectItem value={ALL_ORGANIZATIONS_VALUE}>
            All organizations
          </SelectItem>
        )}
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
