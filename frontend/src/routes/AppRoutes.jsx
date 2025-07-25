import { Routes, Route, Navigate } from "react-router-dom";
import Register from "../pages/Register";
import Login from "../pages/Login";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/Dashboard";
import Clients from "../pages/Clients";
import Invoices from "../pages/Invoices";
import CreateInvoice from "../pages/CreateInvoice";
import Reports from "../pages/Reports";
import AddClient from "../pages/AddClient"; 

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
          <Route path="/invoices/create" element={<CreateInvoice />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/clients/add" element={<AddClient />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
}
