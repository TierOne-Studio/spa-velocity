import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rbacService } from "@features/Admin/services/rbacService";
import { useAuth } from "./AuthContext";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";

interface PermissionsContextType {
    permissions: string[];
    isLoading: boolean;
    can: (resource: string, action: string) => boolean;
    refetchPermissions: () => void;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const permissionsQueryKey = ["rbac", "my-permissions"] as const;

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isAdminOrManager, isLoading: authLoading } = useAuth();
    const queryClient = useQueryClient();

    const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
        queryKey: [...permissionsQueryKey, user?.id ?? "anonymous", user?.role ?? "member"],
        queryFn: () => rbacService.getMyPermissions(),
        enabled: isAuthenticated && isAdminOrManager,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });

    const permissionSet = useMemo(() => new Set(permissions), [permissions]);

    const can = useCallback(
        (resource: string, action: string): boolean => {
            if (!isAuthenticated || !isAdminOrManager) return false;
            if (permissionsLoading) return false;
            return permissionSet.has(`${resource}:${action}`);
        },
        [isAuthenticated, isAdminOrManager, permissionsLoading, permissionSet],
    );

    const refetchPermissions = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: permissionsQueryKey });
    }, [queryClient]);

    // Single loading gate: block rendering until auth AND permissions are resolved.
    // This prevents cascading loading flickers across route guards and components.
    const isAppBootstrapping = authLoading || (isAuthenticated && isAdminOrManager && permissionsLoading);

    const value: PermissionsContextType = useMemo(
        () => ({ permissions, isLoading: permissionsLoading, can, refetchPermissions }),
        [permissions, permissionsLoading, can, refetchPermissions],
    );

    if (isAppBootstrapping) {
        return <LoadingOverlay />;
    }

    return (
        <PermissionsContext.Provider value={value}>
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissionsContext() {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error("usePermissionsContext must be used within a PermissionsProvider");
    }
    return context;
}
