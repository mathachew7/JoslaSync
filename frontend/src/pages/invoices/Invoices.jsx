// src/pages/Invoices.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Search, Download, Trash2, ShieldAlert, X } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  listInvoices,
  getInvoiceStats,
  getMonthlyTotals,
  getTopClients,
  voidInvoice,
  deleteInvoice,
} from "../../api/invoices";
import { getClient } from "../../api/clients";
import DialogBox from "../../components/DialogBox";
import { useAuth } from "../../context/AuthContext";

const COLORS = {
  INVOICE: "#6ee7b7",
  VOID: "#fca5a5",
  Paid: "#16a34a",
  Outstanding: "#3b82f6",
  Overdue: "#ef4444",
};

const PAGE_SIZE = 5;
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const money = (v) => (v == null || v === "" ? "-" : `$${Number(v).toFixed(2)}`);

export default function Invoices() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { viewingTenant } = useAuth();

  // Table data (paginated)
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, page_size: PAGE_SIZE, total: 0 });

  // Filters / controls (table-specific) — pre-seed from URL query params
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("invoice_date");
  const [order, setOrder] = useState("desc");
  const [clientIdFilter, setClientIdFilter] = useState(() => searchParams.get("client_id") || "");

  // Charts + stats
  const [showCharts, setShowCharts] = useState(true);
  const [startYear, setStartYear] = useState(String(new Date().getFullYear()));
  const [endYear, setEndYear] = useState(String(new Date().getFullYear()));
  const [stats, setStats] = useState({ total: 0, paid: 0, outstanding: 0, overdue: 0 });
  const [barData, setBarData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [topClients, setTopClients] = useState([]);

  // Client-name cache
  const [clientMap, setClientMap] = useState({});
  const clientCacheRef = useRef(new Map());

  // Tab state
  const [activeTab, setActiveTab] = useState("");
  const [tabCounts, setTabCounts] = useState({ all: 0, DRAFT: 0, INVOICE: 0, VOID: 0, overdue: 0 });

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("success");
  const [dialogMessage, setDialogMessage] = useState("");

  // Helpers
  const selectedYears = useMemo(
    () => [startYear, endYear].sort((a, b) => parseInt(a) - parseInt(b)),
    [startYear, endYear]
  );

  const [allYears, setAllYears] = useState([]);

  useEffect(() => {
    // fetch all invoices, paginated (backend caps page_size at 100), just to find distinct years
    (async () => {
      try {
        const YEARS_PAGE_SIZE = 100;
        let all = [];
        let page = 1;
        while (true) {
          const res = await listInvoices({ page, page_size: YEARS_PAGE_SIZE, sort: "invoice_date", order: "asc" });
          const batch = res?.data || [];
          all = all.concat(batch);
          if (all.length >= (res?.meta?.total ?? all.length) || batch.length < YEARS_PAGE_SIZE) break;
          page++;
        }
        const y = Array.from(
          new Set(all.map((r) => (r.invoice_date || "").slice(0, 4)))
        ).filter(Boolean).sort();
        if (y.length) {
          setAllYears(y);
          // only update year range if current selection has no data
          setStartYear((prev) => (y.includes(prev) ? prev : y[0]));
          setEndYear((prev) => (y.includes(prev) ? prev : y[y.length - 1]));
        }
      } catch {}
    })();
  }, [viewingTenant?.db_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientNameOf = (inv) =>
    clientMap[inv.client_id] ||
    inv.client?.name ||
    inv.created_by_name ||
    "—";

  // Resolve client names (lazy per-ID)
  const resolveClientName = async (id) => {
    if (!id) return "—";
    if (clientCacheRef.current.has(id)) return clientCacheRef.current.get(id);
    try {
      const c = await getClient(id);
      const name = c?.name || c?.company || c?.email || "—";
      clientCacheRef.current.set(id, name);
      setClientMap((m) => ({ ...m, [id]: name }));
      return name;
    } catch {
      clientCacheRef.current.set(id, "—");
      return "—";
    }
  };

  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean)));
    ids.filter((id) => !clientCacheRef.current.has(id)).forEach(resolveClientName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Fetch counts per status for tab badges
  const fetchTabCounts = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [all, draft, issued, voided, overdue, s] = await Promise.all([
        listInvoices({ page: 1, page_size: 1 }),
        listInvoices({ page: 1, page_size: 1, status: "DRAFT" }),
        listInvoices({ page: 1, page_size: 1, status: "INVOICE" }),
        listInvoices({ page: 1, page_size: 1, status: "VOID" }),
        listInvoices({ page: 1, page_size: 1, status: "INVOICE", date_to: today }),
        getInvoiceStats(),
      ]);
      setTabCounts({
        all:     all?.meta?.total     ?? 0,
        DRAFT:   draft?.meta?.total   ?? 0,
        INVOICE: issued?.meta?.total  ?? 0,
        VOID:    voided?.meta?.total  ?? 0,
        overdue: s?.overdue           ?? 0,
      });
      setStats(s || { total: 0, paid: 0, outstanding: 0, overdue: 0 });
    } catch { /* best effort */ }
  };

  useEffect(() => { fetchTabCounts(); }, [viewingTenant?.db_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch table list (paginated, with table filters)
  const fetchList = async (page = meta.page) => {
    setLoading(true);
    const isOverdueTab = activeTab === "OVERDUE";
    const today = new Date().toISOString().slice(0, 10);
    try {
      const payload = await listInvoices({
        q: q || undefined,
        status: isOverdueTab ? "INVOICE" : (status || undefined),
        client_id: clientIdFilter || undefined,
        page,
        page_size: PAGE_SIZE,
        date_from: dateFrom || undefined,
        date_to: isOverdueTab ? today : (dateTo || undefined),
        sort,
        order,
      });
      setRows(payload?.data || []);
      setMeta(payload?.meta || { page, page_size: PAGE_SIZE, total: 0 });


    } catch {
      setDialogType("error");
      setDialogMessage("Failed to load invoices.");
      setShowDialog(true);
      setRows([]);
      setMeta({ page: 1, page_size: PAGE_SIZE, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Stats + bar chart + top clients (server first, fallback local)
  const computeLocalStats = (source) => {
    const today = new Date();
    const issued = source.filter((i) => i.status === "INVOICE");
    const paid = issued.filter((i) => Number(i.amount_paid ?? 0) >= Number(i.total ?? 0)).length;
    const overdue = issued.filter((i) => {
      if (Number(i.amount_paid ?? 0) >= Number(i.total ?? 0)) return false;
      const due = i.due_date ? new Date(i.due_date + "T00:00:00") : null;
      return due && due < today;
    }).length;
    const outstanding = issued.length - paid - overdue;
    return { total: source.length, paid, outstanding: Math.max(0, outstanding), overdue, draft: 0,
      total_invoiced: 0, total_collected: 0, outstanding_amount: 0, overdue_amount: 0 };
  };

  const computeLocalMonthlyAmounts = (source) => {
    const base = months.map((m) => ({ month: m, Paid: 0, Outstanding: 0, Overdue: 0 }));
    const today = new Date();
    source.forEach((i) => {
      if (i.status !== "INVOICE" || !i.invoice_date) return;
      const d = new Date(i.invoice_date + "T00:00:00");
      const y = d.getFullYear();
      if (y < parseInt(selectedYears[0]) || y > parseInt(selectedYears[1])) return;
      const mName = d.toLocaleString("default", { month: "short" });
      const idx = months.indexOf(mName);
      if (idx < 0) return;
      const collected = Number(i.amount_paid ?? 0);
      const remaining = Math.max(0, Number(i.total ?? 0) - collected);
      const dueDate = i.due_date ? new Date(i.due_date + "T00:00:00") : null;
      base[idx].Paid += collected;
      if (dueDate && dueDate < today) base[idx].Overdue += remaining;
      else base[idx].Outstanding += remaining;
    });
    return base;
  };

  const computeLocalTopClients = (source) => {
    const byClient = source.reduce((acc, inv) => {
      const name = clientNameOf(inv);
      if (!acc[name]) acc[name] = 0;
      acc[name] += Number(inv.total ?? inv.total_amount ?? inv.amount ?? 0);
      return acc;
    }, {});
    return Object.entries(byClient)
      .map(([client, Total]) => ({ client, Total }))
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 5);
  };

  const fetchStatsAndCharts = async () => {
    setLoadingCharts(true);
    try {
      try {
        const s = await getInvoiceStats();
        setStats(s || computeLocalStats(rows));
      } catch {
        setStats(computeLocalStats(rows));
      }

      try {
        const mt = await getMonthlyTotals({
          year_from: parseInt(selectedYears[0]),
          year_to: parseInt(selectedYears[1]),
        });
        const resolved = mt || computeLocalMonthlyAmounts(rows);
        setBarData(resolved);
        setLineData(resolved.map((r) => ({ month: r.month, revenue: r.Paid || 0 })));
      } catch {
        const local = computeLocalMonthlyAmounts(rows);
        setBarData(local);
        setLineData(local.map((r) => ({ month: r.month, revenue: r.Paid || 0 })));
      }

      try {
        const tc = await getTopClients({
          limit: 5,
          year_from: parseInt(selectedYears[0]),
          year_to: parseInt(selectedYears[1]),
        });
        setTopClients(tc || computeLocalTopClients(rows));
      } catch {
        setTopClients(computeLocalTopClients(rows));
      }
    } finally {
      setLoadingCharts(false);
    }
  };

  // Effects
  useEffect(() => {
    setSelected(new Set());
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, clientIdFilter, dateFrom, dateTo, sort, order, viewingTenant?.db_name]);

  useEffect(() => {
    if (parseInt(startYear) > parseInt(endYear)) {
      const t = startYear;
      setStartYear(endYear);
      setEndYear(t);
      return;
    }
    fetchStatsAndCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startYear, endYear, viewingTenant?.db_name]);

  // Derived
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / PAGE_SIZE));
  const totalInvoices = stats.total || tabCounts.all || 0;
  const paidInvoices = stats.paid ?? tabCounts.INVOICE ?? 0;

  // Handlers
  const goPrev = () => meta.page > 1 && fetchList(meta.page - 1);
  const goNext = () => meta.page < totalPages && fetchList(meta.page + 1);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const allPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleRow = (id, e) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const bulkVoid = async () => {
    const voidable = rows.filter((r) => selected.has(r.id) && r.status === "INVOICE").map((r) => r.id);
    if (!voidable.length) {
      setDialogType("error");
      setDialogMessage("No issued invoices selected — only issued invoices can be voided.");
      setShowDialog(true);
      return;
    }
    setBulkLoading(true);
    try {
      await Promise.all(voidable.map((id) => voidInvoice(id)));
      setSelected(new Set());
      fetchList(meta.page);
      fetchTabCounts();
      setDialogType("success");
      setDialogMessage(`${voidable.length} invoice${voidable.length > 1 ? "s" : ""} voided.`);
      setShowDialog(true);
    } catch {
      setDialogType("error");
      setDialogMessage("Some invoices could not be voided.");
      setShowDialog(true);
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkLoading(true);
    try {
      await Promise.all(ids.map((id) => deleteInvoice(id)));
      setSelected(new Set());
      fetchList(meta.page);
      fetchTabCounts();
      setDialogType("success");
      setDialogMessage(`${ids.length} invoice${ids.length > 1 ? "s" : ""} deleted.`);
      setShowDialog(true);
    } catch {
      setDialogType("error");
      setDialogMessage("Some invoices could not be deleted.");
      setShowDialog(true);
    } finally {
      setBulkLoading(false);
    }
  };

  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      // Fetch ALL matching records, paginated (backend caps page_size at 100)
      const EXPORT_PAGE_SIZE = 100;
      let all = [];
      let page = 1;
      while (true) {
        const res = await listInvoices({
          q: q || undefined,
          status: status || undefined,
          client_id: clientIdFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort, order,
          page,
          page_size: EXPORT_PAGE_SIZE,
        });
        const batch = res?.data || [];
        all = all.concat(batch);
        if (all.length >= (res?.meta?.total ?? all.length) || batch.length < EXPORT_PAGE_SIZE) break;
        page++;
      }

      const headers = ["Invoice #", "Client", "Invoice Date", "Due Date", "Status", "Subtotal", "Discount", "Tax", "Total"];
      const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = all.map((inv) => [
        escape(inv.invoice_no ?? ""),
        escape(clientMap[inv.client_id] || inv.client?.name || "—"),
        escape(inv.invoice_date ?? ""),
        escape(inv.due_date ?? ""),
        escape({ INVOICE: "Issued", VOID: "Void", DRAFT: "Draft", QUOTE: "Estimate" }[inv.status] ?? inv.status),
        escape(Number(inv.subtotal ?? 0).toFixed(2)),
        escape(Number(inv.discount_amount ?? 0).toFixed(2)),
        escape(Number(inv.tax_amount ?? 0).toFixed(2)),
        escape(Number(inv.total ?? 0).toFixed(2)),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const label = activeTab ? `invoices-${activeTab.toLowerCase()}` : "invoices-all";
      a.href = url;
      a.download = `${label}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDialogType("error");
      setDialogMessage("Failed to export invoices.");
      setShowDialog(true);
    } finally {
      setExporting(false);
    }
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

      {/* Sub-header: tabs + New Invoice */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { key: "",        label: "All",     count: tabCounts.all },
            { key: "INVOICE", label: "Issued",  count: tabCounts.INVOICE },
            { key: "DRAFT",   label: "Draft",   count: tabCounts.DRAFT },
            { key: "VOID",    label: "Void",    count: tabCounts.VOID },
            { key: "OVERDUE", label: "Overdue", count: tabCounts.overdue, danger: true },
          ].map(({ key, label, count, danger }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  setStatus(key);
                  setMeta((m) => ({ ...m, page: 1 }));
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? danger ? "bg-red-600 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm"
                    : danger ? "text-red-600 hover:bg-red-50" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side: stats summary + actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500 border-r pr-3">
            <span><span className="font-semibold text-gray-800">{totalInvoices}</span> total</span>
            <span><span className="font-semibold text-emerald-600">{paidInvoices}</span> paid</span>
            {stats.outstanding > 0 && <span><span className="font-semibold text-blue-600">{stats.outstanding}</span> outstanding</span>}
            {stats.overdue > 0 && <span><span className="font-semibold text-red-600">{stats.overdue}</span> overdue</span>}
          </div>
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            title="Export current view as CSV"
          >
            <Download size={15} />
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        {/* Search */}
        <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm w-full sm:w-72">
          <Search size={16} className="text-gray-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search invoice #, client…"
            className="outline-none text-sm flex-1 bg-transparent"
            value={q}
            onChange={(e) => { setMeta((m) => ({ ...m, page: 1 })); setQ(e.target.value); }}
          />
        </div>

        {/* Date + Sort */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
            value={dateFrom}
            onChange={(e) => { setMeta((m) => ({ ...m, page: 1 })); setDateFrom(e.target.value); }}
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
            value={dateTo}
            onChange={(e) => { setMeta((m) => ({ ...m, page: 1 })); setDateTo(e.target.value); }}
          />
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="created_at">Created At</option>
            <option value="invoice_date">Invoice Date</option>
            <option value="total">Total</option>
            <option value="invoice_no">Invoice #</option>
          </select>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      {/* Charts Toggle */}
      <button
        className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
        onClick={() => setShowCharts(!showCharts)}
      >
        {showCharts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showCharts ? "Hide Charts" : "Show Charts"}
      </button>

      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart — global counts */}
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Monthly Revenue</h3>
              <div className="flex space-x-2">
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {(allYears.length ? allYears : [startYear]).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {(allYears.length ? allYears : [endYear]).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart — amounts by status (global) */}
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Monthly Totals</h3>
              <div className="flex space-x-2">
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {(allYears.length ? allYears : [startYear]).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {(allYears.length ? allYears : [endYear]).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Paid" fill={COLORS.Paid} />
                <Bar dataKey="Outstanding" fill={COLORS.Outstanding} />
                <Bar dataKey="Overdue" fill={COLORS.Overdue} />
              </BarChart>
            </ResponsiveContainer>
            {loadingCharts && <p className="text-xs text-gray-400 mt-2">Loading chart…</p>}
          </div>

          {/* Top Clients */}
          <div className="bg-white shadow rounded-lg p-5 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Top Clients</h3>
            <ul>
              {topClients.map((c, idx) => (
                <li key={idx} className="flex justify-between border-b py-2">
                  <span className="truncate pr-3">{c.client}</span>
                  <span>{money(c.Total)}</span>
                </li>
              ))}
              {!topClients.length && (
                <li className="text-gray-500 text-sm py-2">No data available.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-xl overflow-hidden">

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-700">
                {selected.size} selected
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-indigo-400 hover:text-indigo-600 inline-flex items-center gap-1"
              >
                <X size={12} /> Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkVoid}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-50 transition"
              >
                <ShieldAlert size={13} /> Void Selected
              </button>
              <button
                onClick={bulkDelete}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 transition"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
              <th className="py-3 pl-4 pr-2 w-8">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4 text-left font-semibold">Invoice #</th>
              <th className="py-3 px-4 text-left font-semibold">Client</th>
              <th className="py-3 px-4 text-left font-semibold">Date</th>
              <th className="py-3 px-4 text-left font-semibold">Due</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                  No invoices found.
                </td>
              </tr>
            )}
            {rows.map((inv) => {
              const isSelected = selected.has(inv.id);
              const statusLabel = { INVOICE: "Issued", VOID: "Void", DRAFT: "Draft", QUOTE: "Estimate" }[inv.status] ?? inv.status;
              const statusStyle = {
                INVOICE: "bg-emerald-50 text-emerald-700 border-emerald-200",
                VOID:    "bg-red-50 text-red-700 border-red-200",
                DRAFT:   "bg-amber-50 text-amber-700 border-amber-200",
              }[inv.status] ?? "bg-gray-50 text-gray-600 border-gray-200";
              return (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className={`border-b last:border-none hover:bg-indigo-50/40 transition cursor-pointer ${isSelected ? "bg-indigo-50/60" : ""}`}
                >
                  <td className="py-3 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleRow(inv.id, e)}
                      className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 font-medium text-indigo-700">{inv.invoice_no ?? "-"}</td>
                  <td className="py-3 px-4 text-gray-700">{clientNameOf(inv)}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {inv.invoice_date ? new Date(inv.invoice_date + "T00:00:00").toLocaleDateString() : "-"}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString() : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-full ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums">
                    {money(inv.total)}
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
}
