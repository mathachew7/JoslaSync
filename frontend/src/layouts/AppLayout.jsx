import { useState, useRef, useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Users, FileText, BarChart2, Settings, Menu, X,
  ChevronDown, Building2, ShieldCheck, LogOut, User,
  Plus, ChevronsUpDown, AlertCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listTenants } from "../api/admin";
import WelcomeModal from "../components/WelcomeModal";

const TENANT_NAV = [
  { path: "/dashboard", label: "Dashboard", icon: Home },
  { path: "/clients",   label: "Clients",   icon: Users },
  { path: "/invoices",  label: "Invoices",  icon: FileText },
  { path: "/reports",   label: "Reports",   icon: BarChart2 },
  { path: "/user-profile", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [
  { path: "/admin",         label: "Platform",  icon: ShieldCheck, exact: true },
  { path: "/admin/tenants", label: "Tenants",   icon: Building2 },
];

function NavLink({ path, label, icon: Icon, exact = false, onClick }) {
  const location = useLocation();
  const active = exact ? location.pathname === path : location.pathname.startsWith(path);
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${active
          ? "bg-slate-700 text-white"
          : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
        }`}
    >
      <Icon size={16} className="shrink-0" />
      {label}
    </Link>
  );
}

function TenantSwitcher({ tenants, viewingTenant, setViewingTenant }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = viewingTenant ? viewingTenant.company_name : "All Companies";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors max-w-48"
      >
        <Building2 size={14} className="text-gray-400 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronsUpDown size={13} className="text-gray-400 shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Switch Company View
          </div>
          <button
            onClick={() => { setViewingTenant(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left
              ${!viewingTenant ? "text-blue-600 font-medium" : "text-gray-700"}`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <ShieldCheck size={12} className="text-blue-600" />
            </div>
            Own Company
            {!viewingTenant && <span className="ml-auto text-[10px] text-blue-500">Current</span>}
          </button>
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => { setViewingTenant(t); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left
                ${viewingTenant?.id === t.id ? "text-blue-600 font-medium" : "text-gray-700"}`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-600">
                {t.company_name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate flex-1">{t.company_name}</span>
              {t.status === "suspended" && (
                <span className="text-[10px] text-red-500 shrink-0">Suspended</span>
              )}
              {viewingTenant?.id === t.id && <span className="ml-auto text-[10px] text-blue-500 shrink-0">Viewing</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tenants,     setTenants]     = useState([]);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const { user, ready, token, logout, viewingTenant, setViewingTenant } = useAuth();

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (isSuperAdmin) {
      listTenants().then(setTenants).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const handler = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeSidebar = () => setSidebarOpen(false);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400 animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  const displayCompany = viewingTenant?.company_name ?? user?.username ?? "Company";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <WelcomeModal />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={closeSidebar} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-slate-800 text-white flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm tracking-wide">JoslaSync</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={closeSidebar}>
            <X size={18} />
          </button>
        </div>

        {/* Nav — tenant section */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            {viewingTenant ? `Viewing: ${viewingTenant.company_name}` : "Workspace"}
          </p>
          {TENANT_NAV.map((item) => (
            <NavLink key={item.path} {...item} onClick={closeSidebar} />
          ))}

          {/* Admin section — super admin only */}
          {isSuperAdmin && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Admin</p>
              </div>
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.path} {...item} onClick={closeSidebar} />
              ))}
            </>
          )}
        </nav>

        {/* Bottom user info */}
        <div className="px-4 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-blue-400 font-medium">
              <ShieldCheck size={10} /> Super Admin
            </span>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Viewing tenant banner */}
        {viewingTenant && (
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} />
              <span>Viewing as <b>{viewingTenant.company_name}</b> — data shown is from their workspace</span>
            </div>
            <button
              onClick={() => setViewingTenant(null)}
              className="font-semibold hover:underline"
            >
              Exit view
            </button>
          </div>
        )}

        {/* ── Top bar ── */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 z-40 relative">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          {/* Company name */}
          <span className="text-sm font-semibold text-gray-800 hidden sm:block">
            {displayCompany}
          </span>

          <div className="flex-1" />

          {/* Tenant switcher — super admin only */}
          {isSuperAdmin && (
            <TenantSwitcher
              tenants={tenants}
              viewingTenant={viewingTenant}
              setViewingTenant={setViewingTenant}
            />
          )}

          {/* Contextual action buttons */}
          <ActionButtons />

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                {user?.username?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700">{user?.username}</span>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-800">{user?.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate("/user-profile"); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <User size={13} /> Profile & Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ActionButtons() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === "/clients") {
    return (
      <button
        onClick={() => navigate("/clients/add")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={14} /> Add Client
      </button>
    );
  }
  if (location.pathname === "/invoices") {
    return (
      <button
        onClick={() => navigate("/invoices/create")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={14} /> New Invoice
      </button>
    );
  }
  if (location.pathname === "/admin/tenants") {
    return (
      <button
        onClick={() => navigate("/admin/tenants/new")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={14} /> New Tenant
      </button>
    );
  }
  return null;
}
