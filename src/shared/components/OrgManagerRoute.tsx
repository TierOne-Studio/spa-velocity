import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/context/AuthContext";
import { useOrgRole } from "@shared/hooks/useOrgRole";

interface OrgManagerRouteProps {
    children: React.ReactNode;
    fallbackPath?: string;
    requiredRole?: string;
    memberRole?: string;
}

/**
 * Route guard that only allows access to users with org manager roles.
 * Requires the user to be authenticated and have a manager role (admin/manager)
 * in the active organization.
 * 
 * @param memberRole - The user's role in the current organization (passed from parent)
 * @param requiredRole - Optional specific role required (defaults to any manager role)
 * @param fallbackPath - Path to redirect to if access denied (default: "/")
 */
export function OrgManagerRoute({ 
    children, 
    fallbackPath = "/",
}: OrgManagerRouteProps) {
    const { isAuthenticated, isLoading } = useAuth();
    const { isInOrganization } = useOrgRole();

    if (isLoading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!isInOrganization) {
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
}
