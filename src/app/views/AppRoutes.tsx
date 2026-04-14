import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
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
import { DashboardPage, SettingsPage, AccountPage } from "@features/Dashboard";
import { UsersPage, SessionsPage, OrganizationsPage, RolesPage } from "@features/Admin";
import { AdminDashboardPage } from "@features/AdminDashboard/views/AdminDashboardPage";
import { ChatPage } from "@features/Chat";
import RootLayout from "./RootLayout";
import { ThemeProvider } from "@shared/components/ui";
import { AuthProvider } from "@shared/context/AuthContext";
import { PermissionsProvider } from "@shared/context/PermissionsContext";
import { ProtectedRoute } from "@shared/components/ProtectedRoute";
import { AdminRoute } from "@shared/components/AdminRoute";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { Toaster } from "@shared/components/ui/sonner";

const queryClient = new QueryClient();

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
                    <Route path="dashboard" element={<DashboardPage />} />

                    {/* Admin routes */}
                    <Route
                      path="chat"
                      element={
                        <AdminRoute
                          fallbackPath="/dashboard"
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
                          fallbackPath="/dashboard"
                          requiredPermission={{ resource: "chat", action: "read" }}
                        >
                          <ChatPage />
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
