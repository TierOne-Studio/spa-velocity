import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/shared/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

import {
    useCreateSqlConnection,
    useUpdateSqlConnection,
} from "../hooks/useSqlConnections"
import type {
    CreateSqlConnectionInput,
    SqlConnection,
    UpdateSqlConnectionInput,
} from "../types"

type Mode = "create" | "edit"

type FormState = {
    name: string
    host: string
    port: string
    database: string
    username: string
    password: string
    schemaName: string
    ssl: boolean
    /**
     * Preserved object SSL config from edit load. The UI only exposes a
     * boolean toggle, so if the stored value is an object (e.g.
     * `{ rejectUnauthorized, ca }`), we keep it here untouched and round-trip
     * it on save when the toggle stays enabled — otherwise a simple edit
     * of an unrelated field would silently clobber the object config with
     * `true`.
     */
    originalSslObject: object | null
}

const EMPTY_FORM: FormState = {
    name: "",
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
    schemaName: "public",
    ssl: false,
    originalSslObject: null,
}

interface SqlConnectionFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    organizationId?: string
    mode: Mode
    connection?: SqlConnection | null
}

export function SqlConnectionFormDialog({
    open,
    onOpenChange,
    organizationId,
    mode,
    connection,
}: SqlConnectionFormDialogProps) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const createMutation = useCreateSqlConnection()
    const updateMutation = useUpdateSqlConnection()

    const isPending = createMutation.isPending || updateMutation.isPending

    useEffect(() => {
        if (!open) return
        if (mode === "edit" && connection) {
            const rawSsl = connection.ssl
            const sslObject =
                rawSsl !== null && typeof rawSsl === "object" ? rawSsl : null
            const sslEnabled = sslObject !== null || rawSsl === true
            setForm({
                name: connection.name,
                host: connection.host,
                port: String(connection.port),
                database: connection.database,
                username: connection.username,
                password: "",
                schemaName: connection.schemaName,
                ssl: sslEnabled,
                originalSslObject: sslObject,
            })
        } else {
            setForm(EMPTY_FORM)
        }
    }, [open, mode, connection])

    const portNumber = Number.parseInt(form.port, 10)
    const portValid = Number.isFinite(portNumber) && portNumber > 0 && portNumber < 65536
    const requiredMissing =
        !form.name.trim() ||
        !form.host.trim() ||
        !form.database.trim() ||
        !form.username.trim() ||
        (mode === "create" && !form.password)
    const disabled = isPending || !portValid || requiredMissing

    async function handleSubmit() {
        if (disabled) return
        try {
            if (mode === "create") {
                const input: CreateSqlConnectionInput & { organizationId?: string } = {
                    organizationId,
                    name: form.name.trim(),
                    host: form.host.trim(),
                    port: portNumber,
                    database: form.database.trim(),
                    username: form.username.trim(),
                    password: form.password,
                    ssl: form.ssl,
                    schemaName: form.schemaName.trim() || "public",
                }
                await createMutation.mutateAsync(input)
                toast.success("SQL connection created")
            } else if (connection) {
                // When the original value was an object (e.g.
                // `{ rejectUnauthorized, ca }`) and the toggle is still on,
                // round-trip the object instead of overwriting it with `true`.
                const sslForUpdate: CreateSqlConnectionInput["ssl"] = form.ssl
                    ? (form.originalSslObject ?? true)
                    : false
                const input: UpdateSqlConnectionInput & { organizationId?: string } = {
                    organizationId,
                    name: form.name.trim(),
                    host: form.host.trim(),
                    port: portNumber,
                    database: form.database.trim(),
                    username: form.username.trim(),
                    ssl: sslForUpdate,
                    schemaName: form.schemaName.trim() || "public",
                }
                if (form.password) input.password = form.password
                await updateMutation.mutateAsync({ id: connection.id, input })
                toast.success("SQL connection updated")
            }
            onOpenChange(false)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Operation failed"
            toast.error(message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]" data-testid="sql-connection-form-dialog">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "Add SQL connection" : "Edit SQL connection"}
                    </DialogTitle>
                    <DialogDescription>
                        Connection credentials are stored encrypted. Use a read-only database role.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="sql-conn-name">Name</Label>
                        <Input
                            id="sql-conn-name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Production reporting DB"
                            data-testid="sql-conn-name"
                        />
                    </div>
                    <div className="grid grid-cols-[1fr_120px] gap-2">
                        <div className="grid gap-2">
                            <Label htmlFor="sql-conn-host">Host</Label>
                            <Input
                                id="sql-conn-host"
                                value={form.host}
                                onChange={(e) => setForm({ ...form, host: e.target.value })}
                                placeholder="db.example.com"
                                data-testid="sql-conn-host"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sql-conn-port">Port</Label>
                            <Input
                                id="sql-conn-port"
                                inputMode="numeric"
                                value={form.port}
                                onChange={(e) => setForm({ ...form, port: e.target.value })}
                                data-testid="sql-conn-port"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-2">
                            <Label htmlFor="sql-conn-db">Database</Label>
                            <Input
                                id="sql-conn-db"
                                value={form.database}
                                onChange={(e) => setForm({ ...form, database: e.target.value })}
                                data-testid="sql-conn-database"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sql-conn-schema">Schema</Label>
                            <Input
                                id="sql-conn-schema"
                                value={form.schemaName}
                                onChange={(e) => setForm({ ...form, schemaName: e.target.value })}
                                data-testid="sql-conn-schema"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-2">
                            <Label htmlFor="sql-conn-user">Username</Label>
                            <Input
                                id="sql-conn-user"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                autoComplete="off"
                                data-testid="sql-conn-username"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sql-conn-pass">
                                Password
                                {mode === "edit" && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        (leave blank to keep)
                                    </span>
                                )}
                            </Label>
                            <Input
                                id="sql-conn-pass"
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                autoComplete="new-password"
                                data-testid="sql-conn-password"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.ssl}
                            onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
                            data-testid="sql-conn-ssl"
                        />
                        Require TLS / SSL
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={disabled}
                        data-testid="sql-conn-submit"
                    >
                        {isPending
                            ? "Saving…"
                            : mode === "create"
                              ? "Create connection"
                              : "Save changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
