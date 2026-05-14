import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/shared/lib/fetch-with-auth";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import type {
    CreateSqlConnectionInput,
    SqlConnection,
    TestSqlConnectionInput,
    TestSqlConnectionResult,
    UpdateSqlConnectionInput,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type ConnectionScope = {
    activeOrganizationId?: string | null;
    userId?: string | null;
};

type ApiResponse<T> = { data: T };

export const sqlConnectionKeys = {
    all: ["admin", "sql-connections"] as const,
    lists: (organizationId: string | undefined, scope?: ConnectionScope) =>
        [
            ...sqlConnectionKeys.all,
            scope?.userId ?? "anonymous",
            scope?.activeOrganizationId ?? "no-org",
            organizationId ?? "scoped",
        ] as const,
};

function useConnectionScope(): ConnectionScope {
    const { data: session } = useEffectiveSession();
    return {
        userId: session?.user?.id ?? null,
        activeOrganizationId:
            (session?.session as { activeOrganizationId?: string } | undefined)
                ?.activeOrganizationId ?? null,
    };
}

async function parseApiResponse<T>(
    response: Response,
    fallbackMessage: string,
): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || fallbackMessage);
    }
    const result: ApiResponse<T> = await response.json();
    return result.data;
}

function buildUrl(path: string, organizationId?: string): string {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (organizationId) url.searchParams.set("organizationId", organizationId);
    return url.toString();
}

async function listSqlConnections(
    organizationId?: string,
): Promise<SqlConnection[]> {
    const response = await fetchWithAuth(
        buildUrl("/api/sql-connections", organizationId),
    );
    return parseApiResponse<SqlConnection[]>(
        response,
        "Failed to list SQL connections",
    );
}

async function createSqlConnection(
    input: CreateSqlConnectionInput & { organizationId?: string },
): Promise<SqlConnection> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/sql-connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse<SqlConnection>(
        response,
        "Failed to create SQL connection",
    );
}

async function updateSqlConnection(
    id: string,
    input: UpdateSqlConnectionInput & { organizationId?: string },
): Promise<SqlConnection> {
    const response = await fetchWithAuth(
        `${API_BASE_URL}/api/sql-connections/${id}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
    );
    return parseApiResponse<SqlConnection>(
        response,
        "Failed to update SQL connection",
    );
}

async function deleteSqlConnection(
    id: string,
    organizationId?: string,
): Promise<void> {
    const response = await fetchWithAuth(
        buildUrl(`/api/sql-connections/${id}`, organizationId),
        { method: "DELETE" },
    );
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete SQL connection");
    }
}

async function testSqlConnection(
    id: string,
    organizationId?: string,
): Promise<SqlConnection> {
    const response = await fetchWithAuth(
        buildUrl(`/api/sql-connections/${id}/test`, organizationId),
        { method: "POST" },
    );
    return parseApiResponse<SqlConnection>(
        response,
        "Failed to test SQL connection",
    );
}

async function testSqlConnectionCredentials(
    input: TestSqlConnectionInput,
    organizationId?: string,
): Promise<TestSqlConnectionResult> {
    const response = await fetchWithAuth(
        buildUrl("/api/sql-connections/test", organizationId),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
    );
    const result = await parseApiResponse<TestSqlConnectionResult>(
        response,
        "Failed to test SQL connection credentials",
    );
    if (!result.ok) {
        throw new Error(result.error);
    }
    return result;
}

async function testCreateOrganizationSqlConnectionCredentials(
    input: TestSqlConnectionInput,
): Promise<TestSqlConnectionResult> {
    const response = await fetchWithAuth(
        `${API_BASE_URL}/api/platform-admin/organizations/sql-connections/test`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
    );
    const result = await parseApiResponse<TestSqlConnectionResult>(
        response,
        "Failed to test SQL connection credentials",
    );
    if (!result.ok) {
        throw new Error(result.error);
    }
    return result;
}

export function useSqlConnections(
    organizationId?: string,
    options?: { enabled?: boolean },
) {
    const scope = useConnectionScope();
    return useQuery({
        queryKey: sqlConnectionKeys.lists(organizationId, scope),
        queryFn: () => listSqlConnections(organizationId),
        enabled: options?.enabled ?? true,
    });
}

export function useCreateSqlConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (
            input: CreateSqlConnectionInput & { organizationId?: string },
        ) => createSqlConnection(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sqlConnectionKeys.all });
        },
    });
}

export function useUpdateSqlConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: {
            id: string;
            input: UpdateSqlConnectionInput & { organizationId?: string };
        }) => updateSqlConnection(params.id, params.input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sqlConnectionKeys.all });
        },
    });
}

export function useDeleteSqlConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: { id: string; organizationId?: string }) =>
            deleteSqlConnection(params.id, params.organizationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sqlConnectionKeys.all });
        },
    });
}

export function useTestSqlConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: { id: string; organizationId?: string }) =>
            testSqlConnection(params.id, params.organizationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sqlConnectionKeys.all });
        },
    });
}

export function useTestSqlConnectionCredentials() {
    return useMutation({
        mutationFn: (params: {
            input: TestSqlConnectionInput;
            organizationId?: string;
        }) => testSqlConnectionCredentials(params.input, params.organizationId),
    });
}

export function useTestCreateOrganizationSqlConnectionCredentials() {
    return useMutation({
        mutationFn: (input: TestSqlConnectionInput) =>
            testCreateOrganizationSqlConnectionCredentials(input),
    });
}
