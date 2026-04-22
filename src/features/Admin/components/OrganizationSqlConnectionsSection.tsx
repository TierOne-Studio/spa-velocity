import { useState } from "react"
import { IconEdit, IconPlus, IconTrash, IconPlayerPlay } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/shared/components/ui/button"

import {
    useDeleteSqlConnection,
    useSqlConnections,
    useTestSqlConnection,
} from "../hooks/useSqlConnections"
import type { SqlConnection } from "../types"

import { SqlConnectionFormDialog } from "./SqlConnectionFormDialog"

interface Props {
    organizationId?: string
    canManage?: boolean
}

function statusClass(status: SqlConnection["status"]): string {
    switch (status) {
        case "ready":
            return "text-xs rounded px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400"
        case "error":
            return "text-xs rounded px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400"
        default:
            return "text-xs rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    }
}

export function OrganizationSqlConnectionsSection({
    organizationId,
    canManage = true,
}: Props) {
    const connectionsQuery = useSqlConnections(organizationId, {
        enabled: Boolean(organizationId),
    })
    const deleteMutation = useDeleteSqlConnection()
    const testMutation = useTestSqlConnection()

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<SqlConnection | null>(null)

    const connections = connectionsQuery.data ?? []
    const loading = connectionsQuery.isLoading
    const error =
        connectionsQuery.error instanceof Error ? connectionsQuery.error.message : null

    async function handleDelete(conn: SqlConnection) {
        if (!confirm(`Delete SQL connection "${conn.name}"?`)) return
        try {
            await deleteMutation.mutateAsync({ id: conn.id, organizationId })
            toast.success("SQL connection deleted")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete")
        }
    }

    async function handleTest(conn: SqlConnection) {
        try {
            await testMutation.mutateAsync({ id: conn.id, organizationId })
            toast.success("Connection test succeeded")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Connection test failed")
        }
    }

    return (
        <div className="space-y-2" data-testid="org-sql-connections-section">
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                    SQL connections
                </div>
                {canManage && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setEditing(null)
                            setFormOpen(true)
                        }}
                        disabled={!organizationId}
                        data-testid="org-sql-add"
                    >
                        <IconPlus className="size-4 mr-1" /> Add connection
                    </Button>
                )}
            </div>
            {loading ? (
                <div className="text-xs text-muted-foreground">Loading connections…</div>
            ) : error ? (
                <div className="text-xs text-red-500">{error}</div>
            ) : connections.length === 0 ? (
                <div className="text-xs text-muted-foreground" data-testid="org-sql-empty">
                    No SQL connections. Add one to let projects query databases from chat.
                </div>
            ) : (
                <ul className="divide-y divide-border rounded-md border" data-testid="org-sql-list">
                    {connections.map((conn) => (
                        <li
                            key={conn.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                            data-testid={`org-sql-row-${conn.id}`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">{conn.name}</span>
                                    <span
                                        className={statusClass(conn.status)}
                                        data-testid={`org-sql-status-${conn.id}`}
                                    >
                                        {conn.status}
                                    </span>
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                    {conn.username}@{conn.host}:{conn.port}/{conn.database}
                                </div>
                                {conn.status === "error" && conn.statusError && (
                                    <div className="truncate text-xs text-red-500">
                                        {conn.statusError}
                                    </div>
                                )}
                            </div>
                            {canManage && (
                                <div className="flex gap-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleTest(conn)}
                                        title="Test connection"
                                        aria-label={`Test connection ${conn.name}`}
                                        data-testid={`org-sql-test-${conn.id}`}
                                    >
                                        <IconPlayerPlay className="size-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                            setEditing(conn)
                                            setFormOpen(true)
                                        }}
                                        title="Edit"
                                        aria-label={`Edit connection ${conn.name}`}
                                        data-testid={`org-sql-edit-${conn.id}`}
                                    >
                                        <IconEdit className="size-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleDelete(conn)}
                                        title="Delete"
                                        aria-label={`Delete connection ${conn.name}`}
                                        data-testid={`org-sql-delete-${conn.id}`}
                                    >
                                        <IconTrash className="size-4" />
                                    </Button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <SqlConnectionFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                organizationId={organizationId}
                mode={editing ? "edit" : "create"}
                connection={editing}
            />
        </div>
    )
}
