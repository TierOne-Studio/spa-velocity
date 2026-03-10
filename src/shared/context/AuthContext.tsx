import React, { createContext, useContext } from "react";
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
    const normalizedRole = (() => {
        if (!rawRole) return "member";
        const roles = Array.isArray(rawRole)
            ? rawRole
            : String(rawRole)
                .split(",")
                .map((r) => r.trim())
                .filter(Boolean);

        if (roles.includes("admin")) return "admin";
        if (roles.includes("manager")) return "manager";
        return "member";
    })();

    const user: User | null = session?.user ? {
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
    } : null;

    const isAuthenticated = !!session?.user;
    const isAdmin = normalizedRole === "admin";
    const isManager = normalizedRole === "manager";
    const isAdminOrManager = isAdmin || isManager;

    const login = async (credentials: LoginCredentials) => {
        const result = await signIn.email({
            email: credentials.email,
            password: credentials.password,
        });

        if (result.error) {
            throw new Error(result.error.message || "Login failed");
        }

        // Refresh session to update isAuthenticated state
        await refetch();
    };

    const signup = async (credentials: SignupCredentials) => {
        const result = await signUp.email({
            name: credentials.name,
            email: credentials.email,
            password: credentials.password,
        });

        if (result.error) {
            throw new Error(result.error.message || "Signup failed");
        }
    };

    const logout = async () => {
        await signOut();
        // Clear bearer tokens on logout
        localStorage.removeItem("bearer_token");
        localStorage.removeItem("original_bearer_token");
    };

    const forgotPassword = async (email: string) => {
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
    };

    const resetPassword = async (token: string, newPassword: string) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, newPassword }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }));
            throw new Error(error.message || "Failed to reset password");
        }
    };

    const sendVerificationEmail = async (email: string) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/send-verification-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "Request failed" }));
            throw new Error(error.message || "Failed to send verification email");
        }
    };

    const refreshSession = async () => {
        await refetch();
    };

    const value: AuthContextType = {
        user,
        isAuthenticated,
        isAdmin,
        isManager,
        isAdminOrManager,
        isLoading,
        login,
        signup,
        logout,
        forgotPassword,
        resetPassword,
        sendVerificationEmail,
        refreshSession,
    };

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
