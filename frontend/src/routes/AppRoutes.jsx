import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login          from "../pages/Login";
import Health         from "../pages/Health";
import SetPassword    from "../pages/SetPassword";
import Setup          from "../pages/onboarding/Setup";
import AppLayout      from "../layouts/AppLayout";

import Dashboard    from "../pages/Dashboard";
import Clients      from "../pages/clients/Clients";
import Invoices     from "../pages/invoices/Invoices";
import CreateInvoice from "../pages/invoices/CreateInvoice";
import InvoiceDetail from "../pages/invoices/InvoiceDetails";
import Reports      from "../pages/Reports";
import AddClient    from "../pages/clients/AddClient";
import EditClient   from "../pages/clients/EditClient";
import ClientDetail from "../pages/clients/ClientDetail";
import UserProfile  from "../pages/companyProfile/UserProfile";

import AdminDashboard from "../pages/admin/AdminDashboard";
import Tenants        from "../pages/admin/Tenants";
import CreateTenant   from "../pages/admin/CreateTenant";
import TenantDetail   from "../pages/admin/TenantDetail";

import { useAuth } from "../context/AuthContext";
import { getHomePath } from "../utils/homePath";

function RequireSuperAdmin({ children }) {
  const { user, ready } = useAuth();
  if (!ready || !user) return null;
  return (user.role === "super_admin" || user.role === "master") ? children : <Navigate to="/dashboard" replace />;
}

export default function AppRoutes() {
  const { ready, token, user, setupComplete } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400 animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  const isLoggedIn = !!token;

  // setupComplete resolves asynchronously right after login/bootstrap — avoid
  // a flash-redirect-then-flash-back by waiting the brief moment it's null.
  if (isLoggedIn && setupComplete === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400 animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  if (isLoggedIn && user?.must_change_password && location.pathname !== "/set-password") {
    return <Navigate to="/set-password" replace />;
  }

  if (isLoggedIn && !user?.must_change_password && setupComplete === false && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  const homePath = getHomePath(user);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={isLoggedIn ? <Navigate to={homePath} replace /> : <Login />} />
      <Route path="/login" element={isLoggedIn ? <Navigate to={homePath} replace /> : <Login />} />
      <Route path="/health" element={<Health />} />

      {isLoggedIn && <Route path="/set-password" element={<SetPassword />} />}
      {isLoggedIn && <Route path="/setup" element={<Setup />} />}

      {/* All authenticated routes use one AppLayout */}
      {isLoggedIn ? (
        <Route element={<AppLayout />}>
          {/* Workspace routes — available to all roles */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/add" element={<AddClient />} />
          <Route path="/clients/:clientId" element={<ClientDetail />} />
          <Route path="/clients/edit/:clientId" element={<EditClient />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/create" element={<CreateInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/user-profile" element={<UserProfile />} />

          {/* Admin-only routes */}
          <Route path="/admin" element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />
          <Route path="/admin/tenants" element={<RequireSuperAdmin><Tenants /></RequireSuperAdmin>} />
          <Route path="/admin/tenants/new" element={<RequireSuperAdmin><CreateTenant /></RequireSuperAdmin>} />
          <Route path="/admin/tenants/:id" element={<RequireSuperAdmin><TenantDetail /></RequireSuperAdmin>} />

          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
