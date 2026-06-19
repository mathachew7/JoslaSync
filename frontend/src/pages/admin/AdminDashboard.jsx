import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, CheckCircle2, XCircle, TrendingUp, Plus } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getAdminStats, listTenants } from "../../api/admin";

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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentTenants, setRecentTenants] = useState([]);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
