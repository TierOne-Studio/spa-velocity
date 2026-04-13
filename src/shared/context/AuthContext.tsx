import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User, AuthState, LoginCredentials, SignupCredentials } from "@features/Auth/types";
import { signIn, signUp, signOut } from "@shared/lib/auth-client";
import { fetchWithAuth } from "@shared/lib/fetch-with-auth";
import { clearAuthStorage } from "@shared/lib/auth-storage";
import { useEffectiveSession } from "@shared/hooks/useEffectiveSession";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface AuthContextType extends AuthState {
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    signup: (credentials: SignupCredentials) => Promise<void>;
    logout: () => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (token: string, newPassword: string) => Promise<void>;
    sendVerificationEmail: (email: string) => Promise<void>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { data: session, isPending: isSessionLoading, refetch } = useEffectiveSession();

    const isSessionAuthenticated = !!session?.user;
    const sessionUserId = session?.user?.id;
    const sessionApprovalStatus = (session?.user as { approvalStatus?: User["approvalStatus"] } | undefined)?.approvalStatus;
    const sessionRejectionReason = (session?.user as { rejectionReason?: string | null } | undefined)?.rejectionReason;

    // Fetch approval status from dedicated endpoint (doesn't depend on better-auth session fields)
    const { data: approvalData, isPending: isApprovalLoading, refetch: refetchApproval } = useQuery({
        queryKey: ["auth", "approval-status", sessionUserId],
        queryFn: async () => {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/me/approval-status`);
            if (!response.ok) {
                return {
                    approvalStatus: sessionApprovalStatus ?? "pending",
                    rejectionReason: sessionRejectionReason ?? null,
                };
            }
            return response.json() as Promise<{ approvalStatus: string; rejectionReason: string | null }>;
        },
        enabled: isSessionAuthenticated,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });
    const resolvedApprovalStatus =
        (approvalData?.approvalStatus as User["approvalStatus"] | undefined) ?? sessionApprovalStatus;
    const resolvedRejectionReason = approvalData?.rejectionReason ?? sessionRejectionReason ?? null;
    const isApprovalStatusLoading =
        isSessionAuthenticated && !resolvedApprovalStatus && isApprovalLoading;

    const rawRole = (session?.user as { role?: string | string[] } | undefined)?.role;
    const normalizedRole = useMemo(() => {
        if (!rawRole) return "member";
        const roles = Array.isArray(rawRole)
            ? rawRole
            : String(rawRole)
                .split(",")
                .map((r) => r.trim())
                .filter(Boolean);

        if (roles.includes("superadmin")) return "superadmin";
        if (roles.includes("admin")) return "admin";
        if (roles.includes("manager")) return "manager";
        return "member";
    }, [rawRole]);

    const user: User | null = useMemo(
        () =>
            session?.user
                ? {
                      id: session.user.id,
                      name: session.user.name,
                      email: session.user.email,
                      role: normalizedRole,
                      image: session.user.image ?? undefined,
                      emailVerified: session.user.emailVerified,
                      banned: (session.user as { banned?: boolean }).banned,
                      banReason: (session.user as { banReason?: string }).banReason,
                      banExpires: (session.user as { banExpires?: Date }).banExpires,
                      approvalStatus: resolvedApprovalStatus,
                      rejectionReason: resolvedRejectionReason,
                      createdAt: session.user.createdAt,
                      updatedAt: session.user.updatedAt,
                  }
                : null,
        [normalizedRole, resolvedApprovalStatus, resolvedRejectionReason, session?.user],
    );

    const isAuthenticated = !!session?.user;
    const isLoading = isSessionLoading || isApprovalStatusLoading;

    const login = useCallback(async (credentials: LoginCredentials) => {
        const result = await signIn.email({
            email: credentials.email,
            password: credentials.password,
        });

        if (result.error) {
            throw new Error(result.error.message || "Login failed");
        }

        // Refresh session to update isAuthenticated state
        await refetch();
    }, [refetch]);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const result = await signUp.email({
            name: credentials.name,
            email: credentials.email,
            password: credentials.password,
        });

        if (result.error) {
            throw new Error(result.error.message || "Signup failed");
        }
    }, []);

    const logout = useCallback(async () => {
        await signOut();
        clearAuthStorage();
    }, []);

    const forgotPassword = useCallback(async (email: string) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/request-password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                redirectTo: `${window.location.origin}/set-new-password`,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }));
            throw new Error(error.message || "Failed to send reset email");
        }
    }, []);

    const resetPassword = useCallback(async (token: string, newPassword: string) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, newPassword }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }));
            throw new Error(error.message || "Failed to reset password");
        }
    }, []);

    const sendVerificationEmail = useCallback(async (email: string) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/send-verification-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }));
            throw new Error(error.message || "Failed to send verification email");
        }
    }, []);

    const refreshSession = useCallback(async () => {
        await refetch();
        await refetchApproval();
    }, [refetch, refetchApproval]);

    const value: AuthContextType = useMemo(
        () => ({
            user,
            isAuthenticated,
            isLoading,
            login,
            signup,
            logout,
            forgotPassword,
            resetPassword,
            sendVerificationEmail,
            refreshSession,
        }),
        [user, isAuthenticated, isLoading, login, signup, logout, forgotPassword, resetPassword, sendVerificationEmail, refreshSession],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
