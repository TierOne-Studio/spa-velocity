import { BrowserRouter, Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../styles/globals.css";
import {
  LoginPage,
  SignupPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  SetNewPasswordPage,
  AcceptInvitationPage,
  PendingApprovalPage,
  AccountRejectedPage,
} from "@features/Auth";
import { SettingsPage, AccountPage } from "@features/Dashboard";
import { UsersPage, SessionsPage, OrganizationsPage, RolesPage } from "@features/Admin";
import { AirweaveCollectionsPage } from "@features/Airweave/views/AirweaveCollectionsPage";
import { AirweaveCollectionDetailPage } from "@features/Airweave/views/AirweaveCollectionDetailPage";
import { SqlConnectionsPage } from "@features/SqlConnections/views/SqlConnectionsPage";
import { VectorDbsPage } from "@features/VectorDb";
import { AdminDashboardPage } from "@features/AdminDashboard/views/AdminDashboardPage";
import { ChatPage } from "@features/Chat";
import { ProjectsPage } from "@features/Projects";
import RootLayout from "./RootLayout";
import { ThemeProvider } from "@shared/components/ui";
import { AuthProvider } from "@shared/context/AuthContext";
import { PermissionsProvider } from "@shared/context/PermissionsContext";
import { ProtectedRoute } from "@shared/components/ProtectedRoute";
import { AdminRoute } from "@shared/components/AdminRoute";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { Toaster } from "@shared/components/ui/sonner";

const queryClient = new QueryClient();

/**
 * Legacy `/admin/airweave/:collectionReadableId` → `/collections/:id` redirect
 * shim. Reads the path param and forwards. Kept for one release post-promotion.
 */
function LegacyAirweaveCollectionRedirect() {
  const { collectionReadableId } = useParams<{ collectionReadableId: string }>();
  if (!collectionReadableId) {
    return <Navigate to="/collections" replace />;
  }
  return <Navigate to={`/collections/${collectionReadableId}`} replace />;
}

const AppRoutesContent = () => {
  const location = useLocation();

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PermissionsProvider>
            <ErrorBoundary resetKey={location.pathname}>
              <Routes>
                  {/* Auth routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/set-new-password" element={<SetNewPasswordPage />} />
                  <Route path="/accept-invitation/:invitationId" element={<AcceptInvitationPage />} />
                  <Route path="/pending-approval" element={<PendingApprovalPage />} />
                  <Route path="/account-rejected" element={<AccountRejectedPage />} />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <RootLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/chat" replace />} />

                    {/* Admin routes */}
                    <Route
                      path="chat"
                      element={
                        <AdminRoute
                          fallbackPath="/account"
                          requiredPermission={{ resource: "chat", action: "read" }}
                        >
                          <ChatPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="chat/:conversationId"
                      element={
                        <AdminRoute
                          fallbackPath="/account"
                          requiredPermission={{ resource: "chat", action: "read" }}
                        >
                          <ChatPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="projects"
                      element={
                        <AdminRoute
                          fallbackPath="/account"
                          requiredPermission={{ resource: "project", action: "read" }}
                        >
                          <ProjectsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="admin/users"
                      element={
                        <AdminRoute requiredPermission={{ resource: "user", action: "read" }}>
                          <UsersPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="admin/sessions"
                      element={
                        <AdminRoute requiredPermission={{ resource: "session", action: "read" }}>
                          <SessionsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="admin/organizations"
                      element={
                        <AdminRoute requiredPermission={{ resource: "organization", action: "read" }}>
                          <OrganizationsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="admin/roles"
                      element={
                        <AdminRoute requiredPermission={{ resource: "role", action: "read" }}>
                          <RolesPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="admin/dashboard"
                      element={
                        <AdminRoute requiredPermission={{ resource: "dashboard", action: "view" }}>
                          <AdminDashboardPage />
                        </AdminRoute>
                      }
                    />
                    {/*
                     * Collections (renamed from Admin → Airweave) — now a
                     * first-class Main feature per ADR-011 amendment 5 +
                     * the PR-2 UX promotion. Permission name `airweave:read`
                     * is preserved (ADR-012 didn't rename the existing
                     * Airweave permission family).
                     */}
                    <Route
                      path="collections"
                      element={
                        <AdminRoute
                          requiredPermission={{ resource: "airweave", action: "read" }}
                          fallbackPath="/account"
                        >
                          <AirweaveCollectionsPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="collections/:collectionReadableId"
                      element={
                        <AdminRoute
                          requiredPermission={{ resource: "airweave", action: "read" }}
                          fallbackPath="/account"
                        >
                          <AirweaveCollectionDetailPage />
                        </AdminRoute>
                      }
                    />
                    {/*
                     * SQL Connections — promoted from embedded Edit-Org
                     * modal section to a first-class Main feature per
                     * ADR-012. Gates on the new `sql-connection:read`
                     * permission.
                     */}
                    <Route
                      path="sql-connections"
                      element={
                        <AdminRoute
                          requiredPermission={{ resource: "sql-connection", action: "read" }}
                          fallbackPath="/account"
                        >
                          <SqlConnectionsPage />
                        </AdminRoute>
                      }
                    />
                    {/*
                     * Vector Databases — first-class Main feature (Slice 2).
                     * Gates on vector-db:read per permissions.ts.
                     */}
                    <Route
                      path="vector-dbs"
                      element={
                        <AdminRoute
                          requiredPermission={{ resource: "vector-db", action: "read" }}
                          fallbackPath="/account"
                        >
                          <VectorDbsPage />
                        </AdminRoute>
                      }
                    />
                    {/*
                     * Legacy redirects from the pre-promotion route paths.
                     * Keep for one release; remove in the follow-up cleanup.
                     */}
                    <Route
                      path="admin/airweave"
                      element={<Navigate to="/collections" replace />}
                    />
                    <Route
                      path="admin/airweave/:collectionReadableId"
                      element={<LegacyAirweaveCollectionRedirect />}
                    />
                    {/* User pages */}
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="account" element={<AccountPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </PermissionsProvider>
          </AuthProvider>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </ThemeProvider>
    );
  };

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AppRoutesContent />
    </BrowserRouter>
  );
};

export default AppRoutes;
