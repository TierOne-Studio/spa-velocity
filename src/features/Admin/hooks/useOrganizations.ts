import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffectiveSession } from "@/shared/hooks/useEffectiveSession";
import { organizationService, type OrganizationFilterParams } from "../services/adminService";

type OrganizationQueryScope = {
    activeOrganizationId?: string | null;
    userId?: string | null;
};

// Query keys
export const organizationKeys = {
    all: ["organizations"] as const,
    lists: () => [...organizationKeys.all, "list"] as const,
    list: (params: OrganizationFilterParams, scope?: OrganizationQueryScope) =>
        [...organizationKeys.lists(), scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", params] as const,
    details: () => [...organizationKeys.all, "detail"] as const,
    detail: (id: string, scope?: OrganizationQueryScope) =>
        [...organizationKeys.details(), scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", id] as const,
    members: (orgId: string, scope?: OrganizationQueryScope) =>
        [...organizationKeys.all, "members", scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", orgId] as const,
    invitations: (orgId: string, scope?: OrganizationQueryScope) =>
        [...organizationKeys.all, "invitations", scope?.userId ?? "anonymous", scope?.activeOrganizationId ?? "no-org", orgId] as const,
    userInvitations: () => [...organizationKeys.all, "userInvitations"] as const,
    activeMember: () => [...organizationKeys.all, "activeMember"] as const,
};

function useOrganizationQueryScope(): OrganizationQueryScope {
    const { data: session } = useEffectiveSession();

    return {
        userId: session?.user?.id ?? null,
        activeOrganizationId:
            (session?.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ?? null,
    };
}

/**
 * Hook to fetch list of organizations with pagination.
 */
export function useOrganizations(
    params: OrganizationFilterParams = {},
    options?: { enabled?: boolean },
) {
    const scope = useOrganizationQueryScope();

    return useQuery({
        queryKey: organizationKeys.list(params, scope),
        queryFn: () => organizationService.listOrganizations(params),
        enabled: options?.enabled ?? true,
    });
}

/**
 * Hook to fetch organization details.
 */
export function useOrganization(organizationId: string) {
    const scope = useOrganizationQueryScope();

    return useQuery({
        queryKey: organizationKeys.detail(organizationId, scope),
        queryFn: () => organizationService.getOrganization(organizationId),
        enabled: !!organizationId,
    });
}

/**
 * Hook to fetch organization members.
 */
export function useOrganizationMembers(organizationId: string) {
    const scope = useOrganizationQueryScope();

    return useQuery({
        queryKey: organizationKeys.members(organizationId, scope),
        queryFn: () => organizationService.listMembers(organizationId),
        enabled: !!organizationId,
    });
}

/**
 * Hook to fetch organization invitations.
 */
export function useOrganizationInvitations(organizationId: string) {
    const scope = useOrganizationQueryScope();

    return useQuery({
        queryKey: organizationKeys.invitations(organizationId, scope),
        queryFn: () => organizationService.listInvitations(organizationId),
        enabled: !!organizationId,
    });
}

/**
 * Hook to create an organization.
 */
export function useCreateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { name: string; slug: string; logo?: string; metadata?: Record<string, unknown> }) =>
            organizationService.createOrganization(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
        },
    });
}

/**
 * Hook to update an organization.
 */
export function useUpdateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ organizationId, data }: { organizationId: string; data: { name?: string; slug?: string; logo?: string; metadata?: Record<string, unknown> } }) =>
            organizationService.updateOrganization(organizationId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.details() });
            queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
        },
    });
}

/**
 * Hook to delete an organization.
 */
export function useDeleteOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (organizationId: string) => organizationService.deleteOrganization(organizationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
        },
    });
}

/**
 * Hook to invite a member.
 */
export function useInviteMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { organizationId: string; email: string; role: string }) =>
            organizationService.inviteMember(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.all });
        },
    });
}

/**
 * Hook to remove a member.
 */
export function useRemoveMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { organizationId: string; memberId: string }) =>
            organizationService.removeMember(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.all });
        },
    });
}

/**
 * Hook to update a member's role.
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { organizationId: string; memberId: string; role: string }) =>
            organizationService.updateMemberRole(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.all });
        },
    });
}

/**
 * Hook to add an existing user to an organization (admin).
 */
export function useAddMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { organizationId: string; userId: string; role: string }) =>
            organizationService.addMember(params.organizationId, params.userId, params.role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.all });
        },
    });
}

/**
 * Hook to check if a slug is available.
 */
export function useCheckSlug() {
    return useMutation({
        mutationFn: (slug: string) => organizationService.checkSlug(slug),
    });
}

/**
 * Hook to set active organization.
 */
export function useSetActiveOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (organizationId: string) => organizationService.setActive(organizationId),
        onSuccess: () => {
            // Invalidate the org list and active-member state, but NOT member/detail queries
            // for specific orgs — those don't change just because the active org switched,
            // and a broad invalidation causes the detail panel to blink on first selection.
            queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: organizationKeys.activeMember() });
        },
    });
}

/**
 * Hook to fetch user's pending invitations.
 */
export function useUserInvitations() {
    return useQuery({
        queryKey: organizationKeys.userInvitations(),
        queryFn: () => organizationService.listUserInvitations(),
    });
}

/**
 * Hook to accept an invitation.
 */
export function useAcceptInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (invitationId: string) => organizationService.acceptInvitation(invitationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.userInvitations() });
            queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
        },
    });
}

/**
 * Hook to reject an invitation.
 */
export function useRejectInvitation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (invitationId: string) => organizationService.rejectInvitation(invitationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.userInvitations() });
        },
    });
}

/**
 * Hook to get invitation details.
 */
export function useInvitation(invitationId: string) {
    return useQuery({
        queryKey: [...organizationKeys.all, "invitation", invitationId] as const,
        queryFn: () => organizationService.getInvitation(invitationId),
        enabled: !!invitationId,
    });
}

/**
 * Hook to get the current user's active member details.
 */
export function useActiveMember() {
    return useQuery({
        queryKey: organizationKeys.activeMember(),
        queryFn: () => organizationService.getActiveMember(),
    });
}

/**
 * Hook to get the current user's role in the active organization.
 */
export function useActiveMemberRole() {
    return useQuery({
        queryKey: [...organizationKeys.activeMember(), "role"] as const,
        queryFn: () => organizationService.getActiveMemberRole(),
    });
}

/**
 * Hook to leave an organization.
 */
export function useLeaveOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (organizationId: string) => organizationService.leaveOrganization(organizationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: organizationKeys.activeMember() });
        },
    });
}
