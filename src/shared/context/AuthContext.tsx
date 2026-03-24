import React, { createContext, useCallback, useContext, useMemo } from "react";
import type { User, AuthState, LoginCredentials, SignupCredentials } from "@features/Auth/types";
import { signIn, signUp, signOut } from "@shared/lib/auth-client";
import { fetchWithAuth } from "@shared/lib/fetch-with-auth";
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
    const { data: session, isPending: isLoading, refetch } = useEffectiveSession();

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
                      createdAt: session.user.createdAt,
                      updatedAt: session.user.updatedAt,
                  }
                : null,
        [normalizedRole, session?.user],
    );

    const isAuthenticated = !!session?.user;

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
        localStorage.clear();
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
    }, [refetch]);

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
        [
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
        ],
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
