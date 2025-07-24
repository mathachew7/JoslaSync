import { Routes, Route, Navigate } from "react-router-dom";
import Register from "../pages/Register";
import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Clients from "../pages/Clients";
import Invoices from "../pages/Invoices";
import Reports from "../pages/Reports";

export default function AppRoutes() {
  const isLoggedIn = true; // temporary, simulating "Master" user

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Register />} />
      <Route path="/login" element={<Login />} />

      {/* Protected */}
      {isLoggedIn ? (
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
}
