import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Register from "../pages/Register";
import Login from "../pages/Login";
import SetPassword from "../pages/SetPassword";
import Setup from "../pages/onboarding/Setup";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminLayout from "../layouts/AdminLayout";

import Dashboard from "../pages/Dashboard";
import Clients from "../pages/clients/Clients";
import Invoices from "../pages/invoices/Invoices";
import CreateInvoice from "../pages/invoices/CreateInvoice";
import InvoiceDetail from "../pages/invoices/InvoiceDetails";
import Reports from "../pages/Reports";
import AddClient from "../pages/clients/AddClient";
import EditClient from "../pages/clients/EditClient";
import ClientDetail from "../pages/clients/ClientDetail";
import UserProfile from "../pages/companyProfile/UserProfile";

import AdminDashboard from "../pages/admin/AdminDashboard";
import Tenants from "../pages/admin/Tenants";
import CreateTenant from "../pages/admin/CreateTenant";
import TenantDetail from "../pages/admin/TenantDetail";

import { useAuth } from "../context/AuthContext";

function RequireSuperAdmin({ children }) {
  const { user, ready } = useAuth();
  if (!ready || !user) return null;
  return user.role === "super_admin"
    ? children
    : <Navigate to="/dashboard" replace />;
}

function RequireTenantUser({ children }) {
  const { user, ready } = useAuth();
  if (!ready || !user) return null;
  if (user.role === "super_admin") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

export default function AppRoutes() {
  const { ready, token, user } = useAuth();
  const location = useLocation();

  // Wait for AuthContext to finish bootstrapping (checks localStorage + /auth/me)
  if (!ready) {
    return (
      <div className="grid place-items-center h-screen bg-gray-50">
        <div className="animate-pulse text-sm text-gray-500">Loading workspace…</div>
      </div>
    );
  }

  const isLoggedIn = !!token;

  // If logged in and must change password, block all routes except /set-password
  if (isLoggedIn && user?.must_change_password && location.pathname !== "/set-password") {
    return <Navigate to="/set-password" replace />;
  }

  return (
    <Routes>
      {/* Public routes — redirect to dashboard if already authenticated */}
      <Route
        path="/"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      {isLoggedIn && (
        <Route path="/set-password" element={<SetPassword />} />
      )}
      {isLoggedIn && (
        <Route path="/setup" element={<Setup />} />
      )}

      {/* Admin portal — super_admin / master only */}
      {isLoggedIn && (
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />
          <Route path="/admin/tenants" element={<RequireSuperAdmin><Tenants /></RequireSuperAdmin>} />
          <Route path="/admin/tenants/new" element={<RequireSuperAdmin><CreateTenant /></RequireSuperAdmin>} />
          <Route path="/admin/tenants/:id" element={<RequireSuperAdmin><TenantDetail /></RequireSuperAdmin>} />
        </Route>
      )}

      {/* Protected routes — tenant users only */}
      {isLoggedIn ? (
        <Route element={<RequireTenantUser><DashboardLayout /></RequireTenantUser>}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Clients */}
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/add" element={<AddClient />} />
          <Route path="/clients/:clientId" element={<ClientDetail />} />
          <Route path="/clients/edit/:clientId" element={<EditClient />} />

          {/* Invoices */}
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/create" element={<CreateInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />

          {/* Reports */}
          <Route path="/reports" element={<Reports />} />

          <Route path="/user-profile" element={<UserProfile />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
