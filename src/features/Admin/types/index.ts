// User types for admin operations
export interface AdminUserMembership {
    organizationId: string;
    organizationName: string;
    roleName: string;
    roleDisplayName?: string;
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role?: string;
    image?: string;
    emailVerified: boolean;
    banned?: boolean;
    banReason?: string;
    banExpires?: number;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
    memberships?: AdminUserMembership[];
}

export interface UserSession {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
}

// Organization types
export interface Organization {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface OrganizationMember {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
    user?: AdminUser;
}

export interface OrganizationInvitation {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    status: "pending" | "accepted" | "rejected" | "canceled";
    expiresAt: Date;
    inviterId: string;
}

export interface AirweaveCollection {
    id: string;
    name: string;
    readableId: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    status: string | null;
    sourceConnectionCount: number;
}

// Pagination types
export interface PaginationParams {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit?: number;
    offset?: number;
}

// Filter types for list operations
export interface UserFilterParams extends PaginationParams {
    searchValue?: string;
    searchField?: "email" | "name";
    searchOperator?: "contains" | "starts_with" | "ends_with";
    organizationId?: string;
    filterField?: string;
    filterValue?: string | number | boolean;
    filterOperator?: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
}

// Action types
export interface CreateUserParams {
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'manager' | 'member';
    organizationId?: string;
    data?: Record<string, unknown>;
}

export interface UpdateUserParams {
    userId: string;
    data: Partial<{
        name: string;
        email: string;
        image: string;
        role: string;
    }>;
}

export interface BanUserParams {
    userId: string;
    banReason?: string;
    banExpiresIn?: number;
}

export interface SetRoleParams {
    userId: string;
    role: string | string[];
}

export interface SetPasswordParams {
    userId: string;
    newPassword: string;
}

// Organization action types
export interface CreateOrganizationParams {
    name: string;
    slug: string;
    logo?: string;
    metadata?: Record<string, unknown>;
}

export interface InviteMemberParams {
    organizationId: string;
    email: string;
    role: string;
}

export interface UpdateMemberRoleParams {
    organizationId: string;
    memberId: string;
    role: string | string[];
}
