import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/context/AuthContext";
import { RouteGuardLoading } from "./RouteGuardLoading";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return <RouteGuardLoading />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Approval gate: block pending/rejected users from the app.
    if (user?.approvalStatus === "pending") {
        return <Navigate to="/pending-approval" replace />;
    }

    if (user?.approvalStatus === "rejected") {
        return <Navigate to="/account-rejected" replace />;
    }

    return <>{children}</>;
}
