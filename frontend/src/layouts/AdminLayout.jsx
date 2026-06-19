import { useState, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, LayoutDashboard, LogOut, Menu, ShieldCheck, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/admin",         icon: LayoutDashboard, label: "Overview", exact: true },
  { to: "/admin/tenants", icon: Building2,        label: "Tenants" },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const isActive = ({ to, exact }) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-gray-900 text-white flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
          <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Joslasync</p>
            <p className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase">Admin Portal</p>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${isActive(item)
                  ? "bg-emerald-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 pb-4 pt-3 border-t border-gray-700">
          <p className="text-[10px] text-gray-600">Joslasync Admin v1.0</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="text-sm font-semibold text-gray-700 flex-1">Admin Portal</h1>

          <div className="relative">
            <button
              onMouseEnter={() => { clearTimeout(dropdownTimer.current); setDropdownOpen(true); }}
              onMouseLeave={() => { dropdownTimer.current = setTimeout(() => setDropdownOpen(false), 150); }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition"
            >
              <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <User size={14} className="text-emerald-700" />
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.username || "Admin"}</span>
            </button>

            {dropdownOpen && (
              <div
                onMouseEnter={() => clearTimeout(dropdownTimer.current)}
                onMouseLeave={() => { dropdownTimer.current = setTimeout(() => setDropdownOpen(false), 150); }}
                className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
              >
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-800">{user?.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
