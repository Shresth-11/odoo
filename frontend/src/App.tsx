import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { CommandPalette } from "./components/CommandPalette";
import { AICopilot } from "./components/AICopilot";

// Import Pages
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Assets } from "./pages/Assets";
import { Allocations } from "./pages/Allocations";
import { Bookings } from "./pages/Bookings";
import { Maintenance } from "./pages/Maintenance";
import { Audits } from "./pages/Audits";
import { Reports } from "./pages/Reports";
import { OrgSetup } from "./pages/OrgSetup";
import { ActivityLogs } from "./pages/ActivityLogs";

// Protected Route Guard Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Layout Wrapper for Authenticated Pages
const AppLayout: React.FC = () => {
  const { logout } = useAuth();
  return (
    <div className="app-container">
      <Sidebar onLogout={logout} />
      <div className="main-wrapper">
        <Header />
        <main className="content-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/allocations" element={<Allocations />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/maintenance" element={<Maintenance />} />
            
            {/* Scoped Pages */}
            <Route
              path="/audits"
              element={
                <ProtectedRoute allowedRoles={["Admin", "Employee"]}>
                  <Audits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={["Admin", "AssetManager", "DepartmentHead"]}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-setup"
              element={
                <ProtectedRoute allowedRoles={["Admin"]}>
                  <OrgSetup />
                </ProtectedRoute>
              }
            />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {/* Global Interactive Overlays */}
      <CommandPalette />
      <AICopilot />
    </div>
  );
};

export const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/landing"
        element={<Landing />}
      />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <AppLayout />
          ) : (
            <Landing />
          )
        }
      />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
