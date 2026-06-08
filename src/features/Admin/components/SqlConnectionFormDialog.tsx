import { useEffect, useMemo, useState } from "react"
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
    OrgTargetField,
    type TargetOrganization,
} from "@/shared/components/forms/OrgTargetField"

import type {
    CreateSqlConnectionInput,
    SqlConnection,
    SqlSslConfig,
    TestSqlConnectionInput,
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
    mode: Mode
    connection?: SqlConnection | null
    initialInput?: CreateSqlConnectionInput | null
    onSubmit: (payload:
        | { mode: "create"; input: CreateSqlConnectionInput; organizationId: string | null }
        | { mode: "edit"; connectionId: string; input: UpdateSqlConnectionInput }) => Promise<void>
    onTest: (input: TestSqlConnectionInput) => Promise<void>
    submitPending?: boolean
    testPending?: boolean
    title?: string
    description?: string
    submitLabel?: string
    /**
     * Org-picker support (ADR-011 amendment 5/6). `defaultOrganizationId` is
     * the owning org for create mode (the page's active org). `organizations`
     * is the superadmin option list (OrgTargetField sources memberships for
     * non-superadmins internally). The picker shows only in create mode; org
     * is immutable on edit.
     */
    defaultOrganizationId?: string | null
    organizations?: TargetOrganization[]
}

function buildEffectiveSsl(form: FormState): SqlSslConfig {
    return form.ssl ? (form.originalSslObject ?? true) : false
}

function buildTestPayload(
    form: FormState,
    portNumber: number,
    connection?: SqlConnection | null,
): TestSqlConnectionInput {
    const payload: TestSqlConnectionInput = {
        host: form.host.trim(),
        port: portNumber,
        database: form.database.trim(),
        username: form.username.trim(),
        ssl: buildEffectiveSsl(form),
    }
    if (form.password) {
        payload.password = form.password
    } else if (connection) {
        payload.connectionId = connection.id
    }
    return payload
}

function buildFingerprint(input: TestSqlConnectionInput): string {
    return JSON.stringify({
        connectionId: input.connectionId ?? null,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        password: input.password ?? "__stored__",
        ssl: input.ssl ?? false,
    })
}

export function SqlConnectionFormDialog({
    open,
    onOpenChange,
    mode,
    connection,
    initialInput,
    onSubmit,
    onTest,
    submitPending = false,
    testPending = false,
    title,
    description,
    submitLabel,
    defaultOrganizationId = null,
    organizations,
}: SqlConnectionFormDialogProps) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [organizationId, setOrganizationId] = useState<string | null>(
        defaultOrganizationId,
    )
    const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null)
    const [requestError, setRequestError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setTestedFingerprint(null)
        setRequestError(null)
        // Owning org is chosen only on create; on edit it's fixed to the row's org.
        setOrganizationId(defaultOrganizationId)
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
            const rawSsl = initialInput?.ssl ?? false
            const sslObject =
                rawSsl !== null && typeof rawSsl === "object" ? rawSsl : null
            const sslEnabled = sslObject !== null || rawSsl === true
            setForm({
                name: initialInput?.name ?? EMPTY_FORM.name,
                host: initialInput?.host ?? EMPTY_FORM.host,
                port: String(initialInput?.port ?? EMPTY_FORM.port),
                database: initialInput?.database ?? EMPTY_FORM.database,
                username: initialInput?.username ?? EMPTY_FORM.username,
                password: initialInput?.password ?? EMPTY_FORM.password,
                schemaName: initialInput?.schemaName ?? EMPTY_FORM.schemaName,
                ssl: sslEnabled,
                originalSslObject: sslObject,
            })
        }
    }, [open, mode, connection, initialInput, defaultOrganizationId])

    const portNumber = Number.parseInt(form.port, 10)
    const portValid = Number.isFinite(portNumber) && portNumber > 0 && portNumber < 65536
    const requiredMissing =
        !form.name.trim() ||
        !form.host.trim() ||
        !form.database.trim() ||
        !form.username.trim() ||
        (mode === "create" && !form.password)
    const testPayload = useMemo(
        () =>
            portValid
                ? buildTestPayload(form, portNumber, connection)
                : null,
        [connection, form, portNumber, portValid],
    )
    const currentFingerprint = testPayload ? buildFingerprint(testPayload) : null
    const testable =
        Boolean(testPayload) &&
        !requiredMissing &&
        (Boolean(form.password) || (mode === "edit" && Boolean(connection)))
    const disabled =
        submitPending ||
        !portValid ||
        requiredMissing ||
        !currentFingerprint ||
        testedFingerprint !== currentFingerprint

    async function handleTest() {
        if (!testPayload || !testable || testPending) return
        try {
            setRequestError(null)
            await onTest(testPayload)
            setTestedFingerprint(buildFingerprint(testPayload))
        } catch (error) {
            setTestedFingerprint(null)
            const message =
                error instanceof Error
                    ? error.message
                    : "Connection test failed"
            setRequestError(message)
            toast.error(message)
        }
    }

    async function handleSubmit() {
        if (disabled) return
        try {
            setRequestError(null)
            if (mode === "create") {
                await onSubmit({
                    mode,
                    organizationId,
                    input: {
                        name: form.name.trim(),
                        host: form.host.trim(),
                        port: portNumber,
                        database: form.database.trim(),
                        username: form.username.trim(),
                        password: form.password,
                        ssl: buildEffectiveSsl(form),
                        schemaName: form.schemaName.trim() || "public",
                    },
                })
            } else if (connection) {
                const input: UpdateSqlConnectionInput = {
                    name: form.name.trim(),
                    host: form.host.trim(),
                    port: portNumber,
                    database: form.database.trim(),
                    username: form.username.trim(),
                    ssl: buildEffectiveSsl(form),
                    schemaName: form.schemaName.trim() || "public",
                }
                if (form.password) input.password = form.password
                await onSubmit({
                    mode,
                    connectionId: connection.id,
                    input,
                })
            }
            onOpenChange(false)
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : mode === "create"
                        ? "Failed to create SQL connection"
                        : "Failed to update SQL connection"
            setRequestError(message)
            toast.error(message)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]" data-testid="sql-connection-form-dialog">
                <DialogHeader>
                    <DialogTitle>
                        {title ?? (mode === "create" ? "Add SQL connection" : "Edit SQL connection")}
                    </DialogTitle>
                    <DialogDescription>
                        {description ?? "Connection credentials are stored encrypted. Use a read-only database role."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    {/*
                     * Org picker (ADR-011 amendment 5/6), create mode only —
                     * the owning org is immutable once a connection exists.
                     * Hidden for single-org members (defaults to their org).
                     */}
                    {mode === "create" && (
                        <OrgTargetField
                            value={organizationId}
                            onChange={setOrganizationId}
                            disabled={submitPending}
                            organizations={organizations}
                            helpText="The connection will belong to this organization."
                            testId="sql-conn-org"
                        />
                    )}
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
                    {requestError && (
                        <div
                            role="alert"
                            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                            data-testid="sql-conn-error"
                        >
                            {requestError}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleTest}
                        disabled={!testable || testPending}
                        data-testid="sql-conn-test"
                    >
                        {testPending ? "Testing…" : "Test connection"}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={disabled}
                        data-testid="sql-conn-submit"
                    >
                        {submitPending
                            ? "Saving…"
                            : submitLabel ??
                              (mode === "create"
                                ? "Create connection"
                                : "Save changes")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
