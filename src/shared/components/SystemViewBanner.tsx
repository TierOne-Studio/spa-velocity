import { IconWorld } from "@tabler/icons-react";

import { cn } from "@/shared/lib/utils";

export interface SystemViewBannerProps {
  /**
   * Whether to render the banner. When `false` the component returns `null`.
   * Pages typically wire this to `useOrgScope().mode === "all"`.
   */
  visible: boolean;
  /** Optional override copy (defaults to the superadmin cross-org message). */
  message?: string;
  /** Optional extra classes for the outer div. */
  className?: string;
  /** Optional data-testid for e2e specs. */
  testId?: string;
}

const DEFAULT_MESSAGE =
  "System view: showing data across all organizations.";

/**
 * Amber banner shown to superadmins when they are viewing data across every
 * organization (ViewingScope === "all"). Visually mirrors `ImpersonationBanner`
 * so the two stack predictably when both are active.
 */
export function SystemViewBanner({
  visible,
  message,
  className,
  testId,
}: SystemViewBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-amber-500 text-amber-950 px-4 py-2 flex items-center gap-2",
        className,
      )}
      data-testid={testId ?? "system-view-banner"}
      role="status"
    >
      <IconWorld className="h-4 w-4" />
      <span className="text-sm font-medium">{message ?? DEFAULT_MESSAGE}</span>
    </div>
  );
}
