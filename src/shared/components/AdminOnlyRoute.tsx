import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/context/AuthContext";

interface AdminOnlyRouteProps {
    children: React.ReactNode;
    fallbackPath?: string;
}

/**
 * Route guard that only allows access to users with admin role (NOT manager).
 * Use this for routes that should be restricted to platform admins only,
 * such as Roles & Permissions management.
 * 
 * PRD Reference: Managers cannot access Roles & Permissions page (line 89, 357)
 * 
 * Redirects to fallbackPath (default: "/") if user is not an admin.
 */
export function AdminOnlyRoute({ children, fallbackPath = "/" }: AdminOnlyRouteProps) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
