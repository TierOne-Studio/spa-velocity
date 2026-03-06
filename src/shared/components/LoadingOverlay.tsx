import { IconLoader2 } from "@tabler/icons-react"

/**
 * Full-screen loading overlay shown once during app bootstrap
 * (auth session + permissions resolution). Prevents cascading
 * loading flickers by gating all rendering behind a single state.
 */
export function LoadingOverlay() {
    return (
        <div
            data-testid="loading-overlay"
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
        >
            <div className="flex flex-col items-center gap-3">
                <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
        </div>
    )
}
