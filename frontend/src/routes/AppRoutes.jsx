// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Register from "../pages/Register";
import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Clients from "../pages/clients/Clients";
import Invoices from "../pages/Invoices";
import CreateInvoice from "../pages/CreateInvoice";
import Reports from "../pages/Reports";
import AddClient from "../pages/clients/AddClient";
import EditClient from "../pages/clients/EditClient";
import CompanyProfile from "../pages/companyProfile/CompanyProfile";
import { initAuth, isAuthenticated } from "../lib/auth";

export default function AppRoutes() {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Initialize auth once and keep it in state (prevents white screen after login)
  useEffect(() => {
    initAuth(); // hydrate axios Authorization from localStorage
    setIsLoggedIn(isAuthenticated());
    setReady(true);

    // Keep in sync if token changes in another tab or via your setAuth()
    const onStorage = (e) => {
      if (e.key === "access_token" || e.key === "token") {
        setIsLoggedIn(isAuthenticated());
      }
    };
    window.addEventListener("storage", onStorage);

    // Optional: listen for a custom event if you dispatch it after login/logout
    const onAuthChanged = () => setIsLoggedIn(isAuthenticated());
    window.addEventListener("auth-changed", onAuthChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, []);

  if (!ready) {
    return <div className="p-6 text-center text-gray-600">Loading…</div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/company-profile" element={<CompanyProfile />} />

      {/* Protected Routes */}
      {isLoggedIn ? (
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/add" element={<AddClient />} />
          <Route path="/clients/edit/:clientId" element={<EditClient />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/create" element={<CreateInvoice />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
