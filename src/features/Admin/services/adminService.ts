import { admin, organization } from "@shared/lib/auth-client";
import { fetchWithAuth } from "@shared/lib/fetch-with-auth";
import type {
    AdminUser,
    UserSession,
    UserFilterParams,
    CreateUserParams,
    UpdateUserParams,
    BanUserParams,
    SetRoleParams,
    SetPasswordParams,
    PaginatedResponse,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const IMPERSONATION_MODE_STORAGE_KEY = "impersonation_mode";

function restoreOriginalToken(originalToken: string): void {
    localStorage.setItem("bearer_token", originalToken);
    localStorage.removeItem("original_bearer_token");
    localStorage.removeItem(IMPERSONATION_MODE_STORAGE_KEY);
}

/**
 * Organization roles metadata type
 */
export type OrgRolesMetadata = {
    roles: Array<{ name: string; displayName: string; description: string | null; color: string | null; isSystem: boolean }>;
    assignableRoles: string[];
};

export type UserCapabilities = {
    targetUserId: string;
    targetRole: "admin" | "manager" | "member";
    isSelf: boolean;
    actions: {
        update: boolean;
        setRole: boolean;
        ban: boolean;
        unban: boolean;
        setPassword: boolean;
        remove: boolean;
        revokeSessions: boolean;
        impersonate: boolean;
    };
};

/**
 * Get organization roles metadata (Better Auth organization roles).
 * Exported separately to fix TypeScript type inference for large object literals.
 */
export async function getOrganizationRolesMetadata(): Promise<OrgRolesMetadata> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/roles-metadata`);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to get organization roles metadata");
    }
    return await response.json();
}

/**
 * Admin service for user management operations.
 * Wraps Better Auth admin client methods.
 */
export const adminService = {
    // ============ User Operations ============

    /**
     * List all users with optional filtering and pagination.
     */
    async listUsers(params: UserFilterParams = {}): Promise<PaginatedResponse<AdminUser>> {
        const url = new URL(`${API_BASE_URL}/api/admin/users`);
        url.searchParams.set("limit", String(params.limit ?? 10));
        url.searchParams.set("offset", String(params.offset ?? 0));
        if (params.searchValue) url.searchParams.set("searchValue", params.searchValue);

        const response = await fetchWithAuth(url.toString());
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to list users");
        }
        return await response.json();
    },

    async getUserCapabilities(userId: string): Promise<UserCapabilities> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/capabilities`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to fetch user capabilities");
        }
        return await response.json();
    },

    async getBatchCapabilities(userIds: string[]): Promise<Record<string, UserCapabilities>> {
        if (userIds.length === 0) return {};
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/capabilities/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to fetch batch capabilities");
        }
        return await response.json();
    },

    /**
     * Create a new user.
     */
    async createUser(params: CreateUserParams): Promise<AdminUser> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: params.email,
                password: params.password,
                name: params.name,
                role: params.role,
                organizationId: params.organizationId,
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to create user");
        }
        return await response.json();
    },

    /**
     * Update a user's details.
     */
    async updateUser(params: UpdateUserParams): Promise<AdminUser> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${params.userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: params.data.name }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to update user");
        }
        return await response.json();
    },

    /**
     * Remove (delete) a user.
     */
    async removeUser(userId: string): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to remove user");
        }
    },

    /**
     * Bulk remove (delete) multiple users.
     */
    async removeUsers(userIds: string[]): Promise<{ success: boolean; deletedCount: number }> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to remove users");
        }
        return await response.json();
    },

    /**
     * Ban a user.
     */
    async banUser(params: BanUserParams): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${params.userId}/ban`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ banReason: params.banReason }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to ban user");
        }
    },

    /**
     * Unban a user.
     */
    async unbanUser(userId: string): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/unban`, {
            method: "POST",
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to unban user");
        }
    },

    /**
     * Set a user's role.
     */
    async setRole(params: SetRoleParams): Promise<void> {
        const role = Array.isArray(params.role) ? params.role[0] : params.role;
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${params.userId}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to set user role");
        }
    },

    /**
     * Set a user's password.
     */
    async setPassword(params: SetPasswordParams): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${params.userId}/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: params.newPassword }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to set user password");
        }
    },

    // ============ Session Operations ============

    /**
     * List all sessions for a user.
     */
    async listUserSessions(userId: string): Promise<UserSession[]> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/sessions`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to list user sessions");
        }
        return await response.json();
    },

    /**
     * Revoke a specific session.
     */
    async revokeSession(sessionToken: string): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/sessions/revoke`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionToken }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to revoke session");
        }
    },

    /**
     * Revoke all sessions for a user.
     */
    async revokeAllSessions(userId: string): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/sessions/revoke-all`, {
            method: "POST",
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to revoke all sessions");
        }
    },

    async getCreateUserMetadata(): Promise<{
        roles: Array<{ name: string; displayName: string; description?: string; color?: string; isSystem: boolean }>;
        allowedRoleNames: Array<'admin' | 'manager' | 'member'>;
        organizations: Array<{ id: string; name: string; slug: string }>;
    }> {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/create-metadata`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to fetch create user metadata");
        }
        return await response.json();
    },

    // ============ Impersonation ============

    /**
     * Impersonate a user.
     * Admin uses Better Auth's built-in endpoint.
     * Manager uses org-scoped endpoint which validates org membership.
     */
    async impersonateUser(userId: string, options?: { role?: string; organizationId?: string }): Promise<void> {
        const role = options?.role || "admin";
        const orgId = options?.organizationId;

        if (role === "admin") {
            const originalToken = localStorage.getItem("bearer_token");
            const { error } = await admin.impersonateUser({ userId });
            if (error) {
                throw new Error(error.message || "Failed to impersonate user");
            }
            if (originalToken) {
                localStorage.setItem("original_bearer_token", originalToken);
            }
            localStorage.setItem(IMPERSONATION_MODE_STORAGE_KEY, "admin");
        } else {
            if (!orgId) {
                throw new Error("Active organization required for manager impersonation");
            }
            const response = await fetchWithAuth(`${API_BASE_URL}/api/organization/${orgId}/impersonate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || "Failed to impersonate user");
            }
            const data = await response.json();
            if (data.sessionToken) {
                // Save original token so we can restore it when stopping impersonation
                const originalToken = localStorage.getItem("bearer_token");
                if (originalToken) {
                    localStorage.setItem("original_bearer_token", originalToken);
                }
                localStorage.setItem("bearer_token", data.sessionToken);
                localStorage.setItem(IMPERSONATION_MODE_STORAGE_KEY, "org");
            } else {
                throw new Error("Missing impersonation session token");
            }
        }
    },

    /**
     * Stop impersonating a user.
     * Admin uses Better Auth's built-in endpoint.
     * Manager uses org-scoped endpoint.
     */
    async stopImpersonating(): Promise<void> {
        const originalToken = localStorage.getItem("original_bearer_token");
        const mode = localStorage.getItem(IMPERSONATION_MODE_STORAGE_KEY);

        if (originalToken && mode === "admin") {
            const { error } = await admin.stopImpersonating();
            if (error) {
                const errorCode = (error as { code?: string }).code;
                const errorMessage = error.message || "";
                const isMissingAdminSession =
                    errorCode === "FAILED_TO_FIND_ADMIN_SESSION" ||
                    errorMessage.toLowerCase().includes("failed to find admin session");

                if (!isMissingAdminSession) {
                    throw new Error(error.message || "Failed to stop impersonating");
                }
            }
            restoreOriginalToken(originalToken);
            return;
        }

        if (originalToken) {
            // Org-scoped impersonation: delete the impersonated session, restore original token
            const response = await fetchWithAuth(`${API_BASE_URL}/api/organization/stop-impersonating`, {
                method: "POST",
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));

                // Recover gracefully when impersonated session is already gone.
                const statusCode =
                    typeof (error as { statusCode?: unknown }).statusCode === "number"
                        ? (error as { statusCode: number }).statusCode
                        : response.status;
                const isSessionNotFound =
                    statusCode === 404 ||
                    (error as { message?: unknown }).message === "Session not found";

                if (isSessionNotFound) {
                    restoreOriginalToken(originalToken);
                    return;
                }

                throw new Error(error.message || "Failed to stop impersonating");
            }
            restoreOriginalToken(originalToken);
        } else {
            if (mode === "org") {
                const adminWithOrgStop = admin as typeof admin & {
                    stopOrgImpersonating?: () => Promise<{ error: { message?: string } | null }>;
                };

                try {
                    if (typeof adminWithOrgStop.stopOrgImpersonating === "function") {
                        const { error } = await adminWithOrgStop.stopOrgImpersonating();
                        if (error) {
                            throw new Error(error.message || "Failed to stop impersonating");
                        }
                    } else {
                        console.warn(
                            "[Impersonation] org stop requested without original token, but admin.stopOrgImpersonating is unavailable; clearing local mode only.",
                        );
                    }
                } finally {
                    localStorage.removeItem(IMPERSONATION_MODE_STORAGE_KEY);
                }

                return;
            }

            // Admin impersonation: use Better Auth's built-in endpoint
            try {
                const { error } = await admin.stopImpersonating();
                if (error) {
                    throw new Error(error.message || "Failed to stop impersonating");
                }
            } finally {
                localStorage.removeItem(IMPERSONATION_MODE_STORAGE_KEY);
            }
        }
    },

};

/**
 * Organization service for organization management operations.
 * Uses platform-admin endpoints for admin access to all organizations.
 */
export interface OrganizationFilterParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface PaginatedOrganizationsResponse {
    data: Array<{
        id: string;
        name: string;
        slug: string;
        logo?: string | null;
        createdAt: Date;
        metadata?: unknown;
        memberCount: number;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const organizationService = {
    /**
     * List all organizations with pagination (admin view).
     */
    async listOrganizations(params: OrganizationFilterParams = {}): Promise<PaginatedOrganizationsResponse> {
        const url = new URL(`${API_BASE_URL}/api/platform-admin/organizations`);
        if (params.page) url.searchParams.set("page", String(params.page));
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.search) url.searchParams.set("search", params.search);

        const response = await fetchWithAuth(url.toString());
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to list organizations");
        }
        return await response.json();
    },

    /**
     * Create a new organization.
     */
    async createOrganization(params: { name: string; slug: string; logo?: string; metadata?: Record<string, unknown> }) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: params.name,
                slug: params.slug,
                logo: params.logo,
                metadata: params.metadata,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to create organization");
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * Get full organization details.
     */
    async getOrganization(organizationId: string) {
        const { data, error } = await organization.getFullOrganization({
            query: { organizationId },
        });

        if (error) {
            throw new Error(error.message || "Failed to get organization");
        }

        return data;
    },

    /**
     * Update an organization.
     */
    async updateOrganization(organizationId: string, data: { name?: string; slug?: string; logo?: string; metadata?: Record<string, unknown> }) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${organizationId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to update organization");
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * Delete an organization (admin - can delete any organization).
     */
    async deleteOrganization(organizationId: string) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${organizationId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to delete organization");
        }
    },

    /**
     * List members of an organization (admin - can view any organization).
     */
    async listMembers(organizationId: string) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${organizationId}/members`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to list members");
        }
        const result = await response.json();
        return result.data ?? [];
    },

    /**
     * Add an existing user to an organization (admin).
     */
    async addMember(organizationId: string, userId: string, role: string) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${organizationId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to add member");
        }
        const result = await response.json();
        return result.data;
    },

    /**
     * Invite a member to an organization.
     */
    async inviteMember(params: { organizationId: string; email: string; role: string }) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${params.organizationId}/invitations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: params.email, role: params.role }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to invite member");
        }
        const result = await response.json();
        return result.data;
    },

    /**
     * Remove a member from an organization.
     */
    async removeMember(params: { organizationId: string; memberId: string }) {
        const response = await fetchWithAuth(
            `${API_BASE_URL}/api/platform-admin/organizations/${params.organizationId}/members/${params.memberId}`,
            {
                method: "DELETE",
            },
        );
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to remove member");
        }
    },

    /**
     * Update a member's role.
     */
    async updateMemberRole(params: { organizationId: string; memberId: string; role: "admin" | "manager" | "member" }) {
        const response = await fetchWithAuth(
            `${API_BASE_URL}/api/platform-admin/organizations/${params.organizationId}/members/${params.memberId}/role`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: params.role }),
            },
        );
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to update member role");
        }
    },

    /**
     * List invitations for an organization (admin - can view any organization).
     */
    async listInvitations(organizationId: string) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${organizationId}/invitations`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to list invitations");
        }
        const result = await response.json();
        return result.data ?? [];
    },

    /**
     * Cancel an invitation.
     */
    async cancelInvitation(params: { organizationId: string; invitationId: string }) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${params.organizationId}/invitations/${params.invitationId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to cancel invitation");
        }
    },

    /**
     * Delete an invitation (admin - can delete any invitation).
     */
    async deleteInvitation(organizationId: string, invitationId: string) {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/platform-admin/organizations/${organizationId}/invitations/${invitationId}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Failed to delete invitation");
        }
    },

    /**
     * Check if a slug is available.
     */
    async checkSlug(slug: string) {
        const { data, error } = await organization.checkSlug({ slug });

        if (error) {
            throw new Error(error.message || "Failed to check slug");
        }

        return data;
    },

    /**
     * Set active organization.
     */
    async setActive(organizationId: string) {
        const { error } = await organization.setActive({ organizationId });

        if (error) {
            throw new Error(error.message || "Failed to set active organization");
        }
    },

    /**
     * Accept an invitation to join an organization.
     */
    async acceptInvitation(invitationId: string) {
        const { data, error } = await organization.acceptInvitation({ invitationId });

        if (error) {
            throw new Error(error.message || "Failed to accept invitation");
        }

        return data;
    },

    /**
     * Reject an invitation to join an organization.
     */
    async rejectInvitation(invitationId: string) {
        const { error } = await organization.rejectInvitation({ invitationId });

        if (error) {
            throw new Error(error.message || "Failed to reject invitation");
        }
    },

    /**
     * Get invitation details by ID.
     */
    async getInvitation(invitationId: string) {
        const { data, error } = await organization.getInvitation({
            query: { id: invitationId },
        });

        if (error) {
            throw new Error(error.message || "Failed to get invitation");
        }

        return data;
    },

    /**
     * List all invitations for the current user.
     */
    async listUserInvitations() {
        const { data, error } = await organization.listUserInvitations();

        if (error) {
            throw new Error(error.message || "Failed to list user invitations");
        }

        return data ?? [];
    },

    /**
     * Get the current user's active member details.
     */
    async getActiveMember() {
        const { data, error } = await organization.getActiveMember();

        if (error) {
            throw new Error(error.message || "Failed to get active member");
        }

        return data;
    },

    /**
     * Get the current user's role in the active organization.
     */
    async getActiveMemberRole() {
        const { data, error } = await organization.getActiveMemberRole();

        if (error) {
            throw new Error(error.message || "Failed to get active member role");
        }

        return data;
    },

    /**
     * Leave an organization.
     */
    async leaveOrganization(organizationId: string) {
        const { error } = await organization.leave({ organizationId });

        if (error) {
            throw new Error(error.message || "Failed to leave organization");
        }
    },

};
