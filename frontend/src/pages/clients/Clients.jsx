// src/pages/Clients.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { listClients, listDeletedClients, restoreClient } from "../../api/clients";
import DialogBox from "../../components/DialogBox";
import { useAuth } from "../../context/AuthContext";

const STATUS_COLORS = ["#6ee7b7", "#93c5fd", "#fca5a5"]; // Active | Deactivated | Blacklisted
const PAGE_SIZE = 5;

export default function Clients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMaster = !!user && (
    user?.roles?.includes?.("MASTER") ||
    user?.email === import.meta.env.VITE_MASTER_EMAIL
  );

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, page_size: PAGE_SIZE, total: 0 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");
  const [activeTab, setActiveTab] = useState("active"); // "active" | "deleted"
  const [deletedRows, setDeletedRows] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [showCharts, setShowCharts] = useState(true);
  const [startYear, setStartYear] = useState("2020");
  const [endYear, setEndYear] = useState("2025");
  const [loading, setLoading] = useState(false);

  // Dialog
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("success");
  const [dialogMessage, setDialogMessage] = useState("");

  // Fetch list
  const fetchData = async (page = meta.page) => {
    setLoading(true);
    try {
      const data = await listClients({
        q: q || undefined,
        status: status || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setRows(data.data || []);
      setMeta(data.meta || { page, page_size: PAGE_SIZE, total: 0 });

      // Initialize year selectors from data
      const years = Array.from(
        new Set((data.data || []).map((c) => (c.created_at || "").slice(0, 4)))
      ).filter(Boolean);
      if (years.length) {
        const min = years.reduce((a, b) => (a < b ? a : b));
        const max = years.reduce((a, b) => (a > b ? a : b));
        if (!years.includes(startYear)) setStartYear(min);
        if (!years.includes(endYear)) setEndYear(max);
      }
    } catch (e) {
      setDialogType("error");
      setDialogMessage("Failed to load clients.");
      setShowDialog(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const fetchDeleted = async () => {
    setLoadingDeleted(true);
    try {
      const data = await listDeletedClients();
      setDeletedRows(data);
    } catch {
      setDialogType("error");
      setDialogMessage("Failed to load deleted clients.");
      setShowDialog(true);
    } finally {
      setLoadingDeleted(false);
    }
  };

  useEffect(() => {
    if (activeTab === "deleted" && isMaster) fetchDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRestore = async (id) => {
    setRestoringId(id);
    try {
      await restoreClient(id);
      setDeletedRows((r) => r.filter((c) => c.id !== id));
      setDialogType("success");
      setDialogMessage("Client restored successfully.");
      setShowDialog(true);
      fetchData(1);
    } catch {
      setDialogType("error");
      setDialogMessage("Failed to restore client.");
      setShowDialog(true);
    } finally {
      setRestoringId(null);
    }
  };

  // Stats
  const totalClients = meta.total || 0;
  const activeClients = rows.filter((c) => c.status === "Active").length;
  const deactivatedClients = rows.filter((c) => c.status === "Deactivated").length;
  const blacklistedClients = rows.filter((c) => c.status === "Blacklisted").length;

  const pieData = useMemo(
    () => [
      { name: "Active", value: activeClients },
      { name: "Deactivated", value: deactivatedClients },
      { name: "Blacklisted", value: blacklistedClients },
    ],
    [activeClients, deactivatedClients, blacklistedClients]
  );

  // Line chart (by created_at month across selected year range, current page slice)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const selectedYears = [startYear, endYear].sort((a, b) => parseInt(a) - parseInt(b));
  const lineData = months.map((m) => {
    const count = rows.filter((c) => {
      const d = c.created_at ? new Date(c.created_at) : null;
      if (!d) return false;
      const monthName = d.toLocaleString("default", { month: "short" });
      const y = d.getFullYear();
      return monthName === m && y >= parseInt(selectedYears[0]) && y <= parseInt(selectedYears[1]);
    }).length;
    return { month: m, clients: count };
  });

  // Pagination handlers
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / PAGE_SIZE));
  const goPrev = () => {
    if (meta.page > 1) fetchData(meta.page - 1);
  };
  const goNext = () => {
    if (meta.page < totalPages) fetchData(meta.page + 1);
  };

  return (
    <div className="space-y-6">
      {showDialog && (
        <DialogBox
          message={dialogMessage}
          type={dialogType}
          onClose={() => setShowDialog(false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Total Clients</h3>
          <p className="text-2xl font-bold">{totalClients}</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Active</h3>
          <p className="text-2xl font-bold text-green-500">{activeClients}</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Deactivated</h3>
          <p className="text-2xl font-bold text-blue-500">{deactivatedClients}</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Blacklisted</h3>
          <p className="text-2xl font-bold text-red-500">{blacklistedClients}</p>
        </div>
      </div>

      {/* Tabs — master only sees Deleted tab */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "active" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Active Clients
        </button>
        {isMaster && (
          <button
            onClick={() => setActiveTab("deleted")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "deleted" ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Trash2 size={13} /> Recycle Bin
            {deletedRows.length > 0 && activeTab !== "deleted" && (
              <span className="ml-1 bg-red-100 text-red-600 text-xs rounded-full px-1.5 py-0.5">{deletedRows.length}</span>
            )}
          </button>
        )}
      </div>

      {activeTab === "deleted" && isMaster ? (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          {loadingDeleted ? (
            <p className="p-6 text-gray-400 text-sm text-center">Loading…</p>
          ) : deletedRows.length === 0 ? (
            <p className="p-8 text-gray-400 text-sm text-center">Recycle bin is empty.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="py-2 px-3 text-left">Name</th>
                  <th className="py-2 px-3 text-left">Email</th>
                  <th className="py-2 px-3 text-left">Company</th>
                  <th className="py-2 px-3 text-left">Status at deletion</th>
                  <th className="py-2 px-3 text-left">Deleted by</th>
                  <th className="py-2 px-3 text-left">Deleted at</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {deletedRows.map((c, i) => (
                  <tr key={c.id} className={`border-b last:border-none ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="py-2 px-3 font-medium text-gray-700">{c.name}</td>
                    <td className="py-2 px-3 text-gray-500">{c.email || "—"}</td>
                    <td className="py-2 px-3 text-gray-500">{c.company || "—"}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-xs rounded border ${
                        c.status === "Active" ? "bg-green-50 text-green-700 border-green-200" :
                        c.status === "Blacklisted" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>{c.status}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{c.deleted_by || "—"}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">
                      {c.deleted_at ? new Date(c.deleted_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleRestore(c.id)}
                        disabled={restoringId === c.id}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <RotateCcw size={12} /> {restoringId === c.id ? "Restoring…" : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {activeTab === "active" && (
      <div className="space-y-6">

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center border rounded px-2 py-1 bg-white shadow-sm w-full sm:w-64">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search name, email, company..."
            className="outline-none text-sm flex-1"
            value={q}
            onChange={(e) => {
              setMeta((m) => ({ ...m, page: 1 }));
              setQ(e.target.value);
            }}
          />
        </div>

        <select
          className="border rounded px-3 py-2 text-sm bg-white shadow-sm w-full sm:w-52"
          value={status}
          onChange={(e) => {
            setMeta((m) => ({ ...m, page: 1 }));
            setStatus(e.target.value);
          }}
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Deactivated">Deactivated</option>
          <option value="Blacklisted">Blacklisted</option>
        </select>

        <button
          onClick={() => setShowCharts(!showCharts)}
          className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
        >
          {showCharts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showCharts ? "Hide Charts" : "Show Charts"}
        </button>
      </div>

      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Clients Added Over Time</h3>
              <div className="flex space-x-2">
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {Array.from(
                    new Set(
                      rows.map((c) => (c.created_at || "").slice(0, 4)).filter(Boolean)
                    )
                  )
                    .sort()
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {Array.from(
                    new Set(
                      rows.map((c) => (c.created_at || "").slice(0, 4)).filter(Boolean)
                    )
                  )
                    .sort()
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="clients" stroke="#3b82f6" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Donut Chart */}
          <div className="bg-white shadow rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-4">Clients by Status (current page)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={STATUS_COLORS[index]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Email</th>
              <th className="py-2 px-3 text-left">Phone</th>
              <th className="py-2 px-3 text-left">Company</th>
              <th className="py-2 px-3 text-left">Created</th>
              <th className="py-2 px-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No clients found.
                </td>
              </tr>
            )}
            {rows.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className={`border-b last:border-none hover:bg-blue-50 transition cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
              >
                <td className="py-2 px-3 font-medium text-gray-800">{c.name}</td>
                <td className="py-2 px-3 text-gray-500">{c.email || "—"}</td>
                <td className="py-2 px-3 text-gray-500">{c.phone || "—"}</td>
                <td className="py-2 px-3 text-gray-500">{c.company || "—"}</td>
                <td className="py-2 px-3 text-gray-500">
                  {c.created_at ? new Date(c.created_at).toISOString().split("T")[0] : "—"}
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 text-xs rounded border ${
                    c.status === "Active"      ? "bg-green-50 text-green-700 border-green-200" :
                    c.status === "Blacklisted" ? "bg-red-50 text-red-700 border-red-200" :
                                                 "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {c.status || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4">
          <button
            disabled={meta.page === 1}
            onClick={goPrev}
            className={`px-4 py-1 text-sm rounded ${
              meta.page === 1 ? "bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Previous
          </button>
          <p className="text-gray-500">
            Page {meta.page} of {totalPages}
          </p>
          <button
            disabled={meta.page === totalPages}
            onClick={goNext}
            className={`px-4 py-1 text-sm rounded ${
              meta.page === totalPages ? "bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Next
          </button>
        </div>
      </div>

      </div>)}
    </div>
  );
}
