import { Routes, Route, Navigate } from "react-router-dom";

import Register from "../pages/Register";
import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";

import Dashboard from "../pages/Dashboard";
import Clients from "../pages/clients/Clients";
import Invoices from "../pages/invoices/Invoices";
import CreateInvoice from "../pages/invoices/CreateInvoice";
import InvoiceDetail from "../pages/invoices/InvoiceDetails";
import Reports from "../pages/Reports";
import AddClient from "../pages/clients/AddClient";
import EditClient from "../pages/clients/EditClient";
import ClientDetail from "../pages/clients/ClientDetail";
import CompanyProfile from "../pages/companyProfile/CompanyProfile";
import UserProfile from "../pages/companyProfile/UserProfile";

import { useAuth } from "../context/AuthContext";

function RequireMaster({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user?.role === "master" ? children : <Navigate to="/dashboard" replace />;
}

export default function AppRoutes() {
  const { ready, token } = useAuth();

  // Wait for AuthContext to finish bootstrapping (checks localStorage + /auth/me)
  if (!ready) {
    return (
      <div className="grid place-items-center h-screen bg-gray-50">
        <div className="animate-pulse text-sm text-gray-500">Loading workspace…</div>
      </div>
    );
  }

  const isLoggedIn = !!token;

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

      {/* Protected routes */}
      {isLoggedIn ? (
        <Route element={<DashboardLayout />}>
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

          {/* User profile & settings (all roles) */}
          <Route path="/user-profile" element={<UserProfile />} />

          {/* Company profile — master only */}
          <Route
            path="/company-profile"
            element={
              <RequireMaster>
                <CompanyProfile />
              </RequireMaster>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
