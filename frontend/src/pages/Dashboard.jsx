import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { getInvoiceStats, getMonthlyTotals, listInvoices } from "../api/invoices";
import { listClients } from "../api/clients";
import { useNavigate } from "react-router-dom";
import { TrendingUp, DollarSign, Clock, AlertTriangle, FileText, Users, FilePen, Percent } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtMoneyFull = (v) =>
  Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const fmtDate = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString() : "—");

const STATUS_STYLES = {
  INVOICE: { label: "Issued",  bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  DRAFT:   { label: "Draft",   bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200"   },
  VOID:    { label: "Void",    bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200"     },
};

export default function Dashboard() {
  const { ready, token } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const currentYear = now.getFullYear();
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo]     = useState(currentYear);

  const [stats,   setStats]   = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [recent,  setRecent]  = useState([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  const selectableYears = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => currentYear - i),
  [currentYear]);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [s, m, ri, cl] = await Promise.all([
          getInvoiceStats(),
          getMonthlyTotals({ year_from: yearFrom, year_to: yearTo }),
          listInvoices({ page: 1, page_size: 6, sort: "invoice_date", order: "desc" }),
          listClients({ page: 1, page_size: 1 }),
        ]);
        if (cancelled) return;
        setStats(s);
        const byName = Object.fromEntries((m || []).map((r) => [r.month, r]));
        setMonthly(MONTHS.map((mo) => ({
          month: mo,
          Collected: byName[mo]?.Paid ?? 0,
          Outstanding: byName[mo]?.Outstanding ?? 0,
        })));
        setRecent(ri?.data || []);
        setClientsTotal(cl?.meta?.total || 0);
      } catch (e) {
        if (!cancelled) setErr("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, token, yearFrom, yearTo]);

  const collectionRate = stats?.total_invoiced > 0
    ? Math.round((stats.total_collected / stats.total_invoiced) * 100)
    : 0;

  const pieData = [
    { name: "Collected",   value: stats?.total_collected   ?? 0 },
    { name: "Outstanding", value: stats?.outstanding_amount ?? 0 },
    { name: "Overdue",     value: stats?.overdue_amount     ?? 0 },
  ];
  const PIE_COLORS = ["#10b981", "#3b82f6", "#ef4444"];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Financial snapshot for your business.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 bg-white shadow-sm text-sm">
            {selectableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-gray-400">to</span>
          <select value={yearTo} onChange={(e) => setYearTo(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 bg-white shadow-sm text-sm">
            {selectableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {err && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">{err}</div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={20} />}
          iconBg="bg-indigo-100 text-indigo-600"
          label="Total Invoiced"
          value={fmtMoney(stats?.total_invoiced)}
          sub={`${stats?.total ?? 0} invoice${stats?.total !== 1 ? "s" : ""}`}
          loading={loading}
        />
        <KpiCard
          icon={<DollarSign size={20} />}
          iconBg="bg-emerald-100 text-emerald-600"
          label="Collected"
          value={fmtMoney(stats?.total_collected)}
          sub={`${stats?.paid ?? 0} paid in full`}
          valueColor="text-emerald-600"
          loading={loading}
        />
        <KpiCard
          icon={<Clock size={20} />}
          iconBg="bg-blue-100 text-blue-600"
          label="Outstanding"
          value={fmtMoney(stats?.outstanding_amount)}
          sub={`${stats?.outstanding ?? 0} invoice${stats?.outstanding !== 1 ? "s" : ""}`}
          valueColor="text-blue-600"
          loading={loading}
        />
        <KpiCard
          icon={<AlertTriangle size={20} />}
          iconBg="bg-red-100 text-red-600"
          label="Overdue"
          value={fmtMoney(stats?.overdue_amount)}
          sub={`${stats?.overdue ?? 0} past due`}
          valueColor={stats?.overdue_amount > 0 ? "text-red-600" : "text-gray-800"}
          loading={loading}
        />
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniKpi icon={<FileText size={16} />} label="All Invoices"   value={stats?.total   ?? "—"} color="text-gray-800" loading={loading} />
        <MiniKpi icon={<FilePen  size={16} />} label="Drafts"         value={stats?.draft   ?? "—"} color="text-amber-600" loading={loading} />
        <MiniKpi icon={<Users    size={16} />} label="Clients"        value={clientsTotal}           color="text-indigo-600" loading={loading} />
        <MiniKpi icon={<Percent  size={16} />} label="Collection Rate" value={loading ? "—" : `${collectionRate}%`} color={collectionRate >= 80 ? "text-emerald-600" : collectionRate >= 50 ? "text-amber-600" : "text-red-600"} loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line chart — 2/3 width */}
        <div className="lg:col-span-2 bg-white shadow rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Revenue Overview</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtMoneyFull(v)} />
              <Legend />
              <Line type="monotone" dataKey="Collected"   stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Outstanding" stroke="#3b82f6" strokeWidth={2.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — 1/3 width */}
        <div className="bg-white shadow rounded-xl p-5 flex flex-col">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Revenue Breakdown</h3>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false} label={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtMoneyFull(v)} />
                <Legend verticalAlign="bottom" height={28} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="h-2 w-2 rounded-full inline-block" style={{ background: PIE_COLORS[i] }} />
                  {d.name}
                </span>
                <span className="font-medium tabular-nums">{fmtMoneyFull(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-base font-semibold text-gray-800">Recent Invoices</h3>
          <button onClick={() => navigate("/invoices")} className="text-sm text-indigo-600 hover:underline">
            View all →
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
              <th className="py-3 px-4 text-left">Invoice #</th>
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left">Payment</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Collected</th>
            </tr>
          </thead>
          <tbody>
            {!loading && recent.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">No invoices yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && recent.map((inv) => {
              const amtPaid = Number(inv.amount_paid ?? 0);
              const total   = Number(inv.total ?? 0);
              const pct     = total > 0 ? Math.min(100, Math.round((amtPaid / total) * 100)) : 0;
              const payStatus = amtPaid >= total ? "Paid" : amtPaid > 0 ? "Partial" : "Unpaid";
              const payColor  = payStatus === "Paid" ? "text-emerald-600" : payStatus === "Partial" ? "text-amber-600" : "text-gray-400";
              const st = STATUS_STYLES[inv.status] || STATUS_STYLES.DRAFT;
              return (
                <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="border-b last:border-none hover:bg-indigo-50/30 cursor-pointer transition">
                  <td className="py-3 px-4 font-medium text-indigo-700">{inv.invoice_no}</td>
                  <td className="py-3 px-4 text-gray-500">{fmtDate(inv.invoice_date)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ring-1 font-medium ${st.bg} ${st.text} ${st.ring}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${payColor}`}>{payStatus}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold">{fmtMoneyFull(total)}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-emerald-600 font-medium">{fmtMoneyFull(amtPaid)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ icon, iconBg, label, value, sub, valueColor = "text-gray-900", loading }) {
  return (
    <div className="bg-white shadow rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${iconBg} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        {loading
          ? <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mt-1" />
          : <p className={`text-2xl font-bold mt-0.5 ${valueColor}`}>{value}</p>
        }
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MiniKpi({ icon, label, value, color, loading }) {
  return (
    <div className="bg-white shadow rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="text-gray-400">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {loading
          ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" />
          : <p className={`text-lg font-bold ${color}`}>{value}</p>
        }
      </div>
    </div>
  );
}
