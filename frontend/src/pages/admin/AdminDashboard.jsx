import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, CheckCircle2, XCircle, TrendingUp, Plus, Activity, RefreshCw, ExternalLink } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getAdminStats, listTenants, getAdminLogs } from "../../api/admin";
import { useHealthStatus } from "../../hooks/useHealthStatus";

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue:    "bg-blue-50 text-blue-600 border-blue-100",
    red:     "bg-red-50 text-red-600 border-red-100",
    violet:  "bg-violet-50 text-violet-600 border-violet-100",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-emerald-600 mt-0.5">{payload[0].value} tenant{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
};

function SystemPanel() {
  const health = useHealthStatus();
  const [logLines, setLogLines] = useState([]);
  const [logError, setLogError] = useState("");
  const [logLoading, setLogLoading] = useState(true);
  const boxRef = useRef(null);

  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const data = await getAdminLogs(300);
      setLogLines(data.lines || []);
      setLogError(data.error || "");
    } catch {
      setLogError("Failed to load logs.");
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logLines]);

  return (
    <div className="space-y-6">
      {/* Live status */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            <span className="text-sm font-semibold text-gray-700">Live status</span>
          </div>
          <a
            href="/health"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
          >
            Public status page <ExternalLink size={11} />
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Status</p>
            <p className={`font-semibold ${health.status === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {health.status === "checking" ? "Checking…" : health.status === "ok" ? "Operational" : health.status}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Database</p>
            <p className="font-semibold text-gray-800">
              {health.components.find((c) => c.name === "Database")?.status === "ok" ? "Operational" : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Uptime since deploy</p>
            <p className="font-semibold text-gray-800">
              {health.uptimeSeconds != null ? `${Math.floor(health.uptimeSeconds / 60)}m` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Version</p>
            <p className="font-semibold text-gray-800">{health.version ? `v${health.version}` : "—"}</p>
          </div>
        </div>
      </div>

      {/* Log viewer */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Backend logs (last 300 lines, auto-refreshing)</span>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={12} className={logLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <div
          ref={boxRef}
          className="bg-gray-900 text-gray-200 font-mono text-xs p-4 h-80 overflow-y-auto whitespace-pre-wrap"
        >
          {logError ? (
            <span className="text-red-400">{logError}</span>
          ) : logLines.length ? (
            logLines.map((line, i) => <div key={i}>{line}</div>)
          ) : (
            <span className="text-gray-500">No log output yet.</span>
          )}
        </div>
        <p className="px-5 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          This reads the backend's own log file directly — it won't show infra-level detail
          (CPU, memory, deploy history) that only Coolify itself has access to.
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentTenants, setRecentTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    Promise.all([getAdminStats(), listTenants()])
      .then(([s, t]) => {
        setStats(s);
        setRecentTenants(t.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Overview</h2>
          <p className="text-sm text-gray-400 mt-0.5">Platform health at a glance</p>
        </div>
        <Link
          to="/admin/tenants/new"
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
        >
          <Plus size={15} /> New tenant
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "overview", label: "Overview" },
          { id: "system", label: "System status" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "system" ? (
        <SystemPanel />
      ) : (
      <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total tenants"   value={stats.total_tenants}    sub={`${stats.tenants_this_month} this month`} color="blue" />
        <StatCard icon={CheckCircle2} label="Active"       value={stats.active_tenants}   color="emerald" />
        <StatCard icon={XCircle}      label="Suspended"    value={stats.suspended_tenants} color="red" />
        <StatCard icon={Users}        label="Total users"  value={stats.total_users}       color="violet" />
      </div>

      {/* Growth chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-emerald-500" />
          <span className="text-sm font-semibold text-gray-700">Tenant growth (last 12 months)</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={stats.monthly_growth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="tenants" stroke="#10b981" strokeWidth={2} fill="url(#tGrad)" dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent tenants */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Recent tenants</span>
          <Link to="/admin/tenants" className="text-xs text-emerald-600 hover:underline">View all</Link>
        </div>
        {recentTenants.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No tenants yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Company", "Users", "Status", "Created"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentTenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-medium text-gray-800">{t.company_name}</td>
                  <td className="px-5 py-3 text-gray-500">{t.users.length}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
                      ${t.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${t.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </div>
  );
}
