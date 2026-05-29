import { useOrgCapabilities } from "@/shared/hooks/useOrgCapabilities"
import { usePermissionsContext } from "@/shared/context/PermissionsContext"
import { OrganizationSqlConnectionsSection } from "@features/Admin/components/OrganizationSqlConnectionsSection"

/**
 * SQL Connections — first-class Main page (ADR-012).
 *
 * Wraps the existing `OrganizationSqlConnectionsSection` manager (extracted
 * from the Edit-Organization admin modal in PR-2) with a page header and
 * scopes it to the active organization. Permission-gated by `AdminRoute`
 * upstream on `sql-connection:read`; mutate buttons render conditionally on
 * `sql-connection:create|update|delete`.
 *
 * Multi-org users currently must switch via the OrganizationSwitcher in the
 * sidebar to operate against a different org. A future enhancement adds
 * `OrgTargetField` to the create dialog so multi-org users can pick the
 * owning org per-resource (matching the Airweave amendment-5 pattern).
 */
export function SqlConnectionsPage() {
    const { activeOrganizationId } = useOrgCapabilities()
    const { can } = usePermissionsContext()
    const canManage = can("sql-connection", "update")

    return (
        <div
            className="flex flex-1 flex-col gap-4 p-4 lg:p-6"
            data-testid="sql-connections-page"
        >
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">SQL Connections</h1>
                <p className="text-sm text-muted-foreground">
                    Manage database credentials for the active organization. Connections can
                    be attached to projects so chat agents can query the database.
                </p>
            </header>
            {!activeOrganizationId ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Select an organization from the switcher to manage SQL connections.
                </div>
            ) : (
                <OrganizationSqlConnectionsSection
                    organizationId={activeOrganizationId}
                    canManage={canManage}
                />
            )}
        </div>
    )
}
