import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/context/AuthContext";
import { usePermissionsContext } from "@shared/context/PermissionsContext";

interface AdminRouteProps {
    children: React.ReactNode;
    fallbackPath?: string;
    requiredPermission?: {
        resource: string;
        action: string;
    };
}

/**
 * Route guard that allows access to admin/manager users.
 * Optionally enforces a required permission (resource/action) using DB-backed permissions.
 * Redirects to fallbackPath (default: "/") when access is not allowed.
 */
export function AdminRoute({ children, fallbackPath = "/", requiredPermission }: AdminRouteProps) {
    const { isAuthenticated, isAdminOrManager } = useAuth();
    const { can } = usePermissionsContext();

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to fallback if not admin/manager
    if (!isAdminOrManager) {
        return <Navigate to={fallbackPath} replace />;
    }

    if (requiredPermission && !can(requiredPermission.resource, requiredPermission.action)) {
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
}
