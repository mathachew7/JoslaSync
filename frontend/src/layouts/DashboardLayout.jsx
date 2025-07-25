import { useState, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, FileText, BarChart, Menu, User, Plus, Settings } from "lucide-react";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const companyName = "Dream Builders"; // Dynamic later

  const navLinks = [
    { path: "/dashboard", label: "Dashboard", icon: <Home size={18} /> },
    { path: "/clients", label: "Clients", icon: <Users size={18} /> },
    { path: "/invoices", label: "Invoices", icon: <FileText size={18} /> },
    { path: "/reports", label: "Reports", icon: <BarChart size={18} /> },
  ];

  const openDropdown = () => {
    if (dropdownTimer.current) clearTimeout(dropdownTimer.current);
    setDropdownOpen(true);
  };

  const closeDropdown = () => {
    dropdownTimer.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 200);
  };

  // Check active pages to show the correct action button
  const isClientsPage = location.pathname === "/clients";
  const isInvoicesPage = location.pathname === "/invoices";

  return (
    <div className="flex h-screen font-sans bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed md:static top-0 left-0 h-full w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 shadow-xl z-50`}
      >
        <div className="p-5 text-2xl font-extrabold tracking-wide border-b border-gray-700">
          Joslasync
        </div>

        <nav className="flex-1 p-5 space-y-3 overflow-y-auto text-gray-300">
          {navLinks.map(({ path, label, icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition ${
                location.pathname === path
                  ? "bg-gray-700 text-white shadow"
                  : "hover:bg-gray-700 hover:text-white"
              }`}
            >
              {icon} <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-5 border-t border-gray-700 text-xs text-gray-400">
          Logged in as <b>Master</b>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Section */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* Topbar */}
        <header className="bg-white shadow-md p-4 flex items-center justify-between sticky top-0 z-40">
          {/* Mobile toggle */}
          <button
            className="md:hidden text-gray-700 hover:text-blue-600"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={26} />
          </button>

          {/* Company name */}
          <h1 className="text-lg font-bold text-gray-800 tracking-wide">
            {companyName} Dashboard
          </h1>

          {/* Profile Dropdown */}
          <div
            className="relative"
            onMouseEnter={openDropdown}
            onMouseLeave={closeDropdown}
          >
            <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition">
              <User size={22} className="text-gray-700" />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg"
                onMouseEnter={openDropdown}
                onMouseLeave={closeDropdown}
              >
                {/* Profile */}
                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <Settings size={16} />
                  Profile & Settings
                </button>

                <div className="px-4 py-2 text-gray-600 text-sm border-t">
                  Logged in as <b>Master</b>
                </div>

                <button className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Header (Title + Contextual Action Buttons) */}
        <div className="w-full p-4 border-y bg-white shadow-sm flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-800">
            {navLinks.find((link) => link.path === location.pathname)?.label || "Page"}
          </span>

          {/* Action Buttons for Clients or Invoices */}
          {isClientsPage && (
            <button
              onClick={() => navigate("/clients/add")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow"
            >
              <Plus size={18} /> Add Client
            </button>
          )}

          {isInvoicesPage && (
            <button
              onClick={() => navigate("/invoices/create")}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition shadow"
            >
              <Plus size={18} /> Create Invoice
            </button>
          )}
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-gray-100 border-t text-center p-4 text-xs text-gray-500">
          © {new Date().getFullYear()} Joslasync • All Rights Reserved
        </footer>
      </div>
    </div>
  );
}
