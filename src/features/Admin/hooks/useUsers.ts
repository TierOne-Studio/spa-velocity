import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService, type UserCapabilities } from "../services/adminService";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import type {
    UserFilterParams,
    CreateUserParams,
    UpdateUserParams,
    BanUserParams,
    SetRoleParams,
    SetPasswordParams,
} from "../types";

type UserQueryScope = {
    activeOrganizationId?: string | null;
    userId?: string | null;
};

// Query keys
export const userKeys = {
    all: ["users"] as const,
    lists: () => [...userKeys.all, "list"] as const,
    list: (params: UserFilterParams, scope?: UserQueryScope) =>
        [...userKeys.lists(), scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", params] as const,
    details: () => [...userKeys.all, "detail"] as const,
    detail: (id: string, scope?: UserQueryScope) =>
        [...userKeys.details(), scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", id] as const,
    sessions: (userId: string, scope?: UserQueryScope) =>
        [...userKeys.all, "sessions", scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", userId] as const,
    capabilities: (userId: string, scope?: UserQueryScope) =>
        [...userKeys.all, "capabilities", scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", userId] as const,
    batchCapabilities: (userIds: string[], scope?: UserQueryScope) =>
        [...userKeys.all, "capabilities", "batch", scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", userIds] as const,
};

function useUserQueryScope(): UserQueryScope {
    const { data: session } = useEffectiveSession();

    return {
        userId: session?.user?.id ?? null,
        activeOrganizationId:
            (session?.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ?? null,
    };
}

/**
 * Hook to fetch paginated list of users with server-side filtering.
 */
export function useUsers(params: UserFilterParams & { enabled?: boolean } = {}) {
    const { enabled = true, ...filterParams } = params;
    const scope = useUserQueryScope();

    return useQuery({
        queryKey: userKeys.list(filterParams, scope),
        queryFn: () => adminService.listUsers(filterParams),
        enabled,
    });
}

/**
 * Hook to fetch backend-computed capabilities for a target user.
 */
export function useUserCapabilities(userId: string) {
    const scope = useUserQueryScope();

    return useQuery<UserCapabilities>({
        queryKey: userKeys.capabilities(userId, scope),
        queryFn: () => adminService.getUserCapabilities(userId),
        enabled: !!userId,
    });
}

/**
 * Hook to fetch backend-computed capabilities for a batch of users in a single request.
 * Replaces N individual useUserCapabilities calls with one batch request.
 */
export function useUserCapabilitiesBatch(userIds: string[], enabled = true) {
    const scope = useUserQueryScope();

    return useQuery<Record<string, UserCapabilities>>({
        queryKey: userKeys.batchCapabilities(userIds, scope),
        queryFn: () => adminService.getBatchCapabilities(userIds),
        enabled: enabled && userIds.length > 0,
        staleTime: 60_000,
    });
}

/**
 * Hook to fetch user sessions.
 */
export function useUserSessions(userId: string) {
    const scope = useUserQueryScope();

    return useQuery({
        queryKey: userKeys.sessions(userId, scope),
        queryFn: () => adminService.listUserSessions(userId),
        enabled: !!userId,
    });
}

/**
 * Hook to create a new user.
 */
export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: CreateUserParams) => adminService.createUser(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to update a user.
 */
export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: UpdateUserParams) => adminService.updateUser(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to remove a user.
 */
export function useRemoveUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => adminService.removeUser(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to bulk remove multiple users.
 */
export function useRemoveUsers() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userIds: string[]) => adminService.removeUsers(userIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to ban a user.
 */
export function useBanUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: BanUserParams) => adminService.banUser(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to unban a user.
 */
export function useUnbanUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => adminService.unbanUser(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to set a user's role.
 */
export function useSetUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: SetRoleParams) => adminService.setRole(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });
}

/**
 * Hook to set a user's password.
 */
export function useSetUserPassword() {
    return useMutation({
        mutationFn: (params: SetPasswordParams) => adminService.setPassword(params),
    });
}

/**
 * Hook to revoke a user session.
 */
export function useRevokeSession() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionToken: string) => adminService.revokeSession(sessionToken),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
        },
    });
}

/**
 * Hook to revoke all user sessions.
 */
export function useRevokeAllSessions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => adminService.revokeAllSessions(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
        },
    });
}

/**
 * Hook to impersonate a user.
 */
export function useImpersonateUser() {
    return useMutation({
        mutationFn: (params: { userId: string; organizationId?: string }) =>
            adminService.impersonateUser(params.userId, { organizationId: params.organizationId }),
    });
}

/**
 * Hook to stop impersonating.
 */
export function useStopImpersonating() {
    return useMutation({
        mutationFn: () => adminService.stopImpersonating(),
    });
}
