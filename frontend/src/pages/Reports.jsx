// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { listInvoices, getTopClients } from "../api/invoices";
import { listClients } from "../api/clients";

/** ---------- helpers ---------- */
const MAX_API_PAGE_SIZE = 100; // Backend max (avoid 422)

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => (iso ? new Date(iso).toISOString().split("T")[0] : "—");

const toNumber = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v) =>
  toNumber(v).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const rangePresets = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const lastMonthLastDay = new Date(y, m, 0);
  const lastMonthFirstDay = new Date(y, m - 1, 1);
  const quarterStartMonth = Math.floor(m / 3) * 3;
  const firstOfQuarter = new Date(y, quarterStartMonth, 1);
  const firstOfYear = new Date(y, 0, 1);
  const toISO = (dt) => dt.toISOString().slice(0, 10);
  return {
    THIS_MONTH: { from: toISO(firstOfMonth), to: todayISO() },
    LAST_MONTH: { from: toISO(lastMonthFirstDay), to: toISO(lastMonthLastDay) },
    QTD: { from: toISO(firstOfQuarter), to: todayISO() },
    YTD: { from: toISO(firstOfYear), to: todayISO() },
  };
};

const BUCKETS = [
  { key: "current", label: "Current", test: (days) => days === 0 },
  { key: "d30", label: "1–30", test: (days) => days >= 1 && days <= 30 },
  { key: "d60", label: "31–60", test: (days) => days >= 31 && days <= 60 },
  { key: "d90", label: "61–90", test: (days) => days >= 61 && days <= 90 },
  { key: "d120", label: "90+", test: (days) => days > 90 },
];

/** CSV exporter */
function downloadCSV(filename, rows) {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** fetch ALL invoices across pages (respects backend max=100) */
async function fetchAllInvoices(params) {
  let page = 1;
  let out = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await listInvoices({
      ...params,
      page,
      page_size: MAX_API_PAGE_SIZE,
    });
    out = out.concat(res.data || []);
    const total = res.meta?.total ?? out.length;
    if (out.length >= total) break;
    page += 1;
    if (page > 200) break; // hard stop
  }
  return out;
}

/** fetch ALL clients across pages (respects backend max=100) */
async function fetchAllClients() {
  let page = 1;
  let out = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await listClients({ page, page_size: MAX_API_PAGE_SIZE });
    out = out.concat(res.data || []);
    const total = res.meta?.total ?? out.length;
    if (out.length >= total) break;
    page += 1;
    if (page > 200) break; // hard stop
  }
  return out;
}

/** ---------- Reports page ---------- */
export default function Reports() {
  const presets = useMemo(rangePresets, []);
  const [tab, setTab] = useState("aging"); // default you were viewing
  const [dateFrom, setDateFrom] = useState(presets.YTD.from);
  const [dateTo, setDateTo] = useState(presets.YTD.to);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("INVOICE");

  const [clients, setClients] = useState([]);
  const clientsById = useMemo(() => {
    const map = new Map();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [revenueRows, setRevenueRows] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState({
    invoices: 0,
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    avg: 0,
  });

  const [agingRows, setAgingRows] = useState([]);
  const [agingAsOf, setAgingAsOf] = useState(todayISO());

  const [topRows, setTopRows] = useState([]);

  // we keep the fetched invoices here so we can rebuild tables when clients list loads (names)
  const [invoicesCache, setInvoicesCache] = useState([]);

  // init clients for dropdown + name lookup
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await fetchAllClients();
        if (!alive) return;
        setClients(all);
      } catch {
        /* ignore for now */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedClientLabel = useMemo(() => {
    if (!clientId) return "All clients";
    const c = clientsById.get(clientId);
    return c?.name || c?.company || "(Client)";
  }, [clientId, clientsById]);

  /** Build aging rows (name lookup via clients list + invoice.client fallback) */
  const buildAging = (invs) => {
    const now = new Date();
    const byClient = new Map();

    invs.forEach((i) => {
      const due = i.due_date ? new Date(i.due_date) : null;
      let daysOver = 0;
      if (due) {
        const ms =
          new Date(now.toDateString()).getTime() -
          new Date(due.toDateString()).getTime();
        daysOver = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
      }

      // 👇 robust client label
      const fromMap = clientsById.get(i.client_id);
      const name =
        fromMap?.name ||
        fromMap?.company ||
        i.client?.name ||
        i.client?.company ||
        "All"; // when single-client mode and no embed, we’ll replace with selected label below

      const total = toNumber(i.total);
      const row =
        byClient.get(name) || {
          client: name,
          current: 0,
          d30: 0,
          d60: 0,
          d90: 0,
          d120: 0,
          total: 0,
        };

      const bucketKey = BUCKETS.find((b) => b.test(daysOver))?.key || "current";
      row[bucketKey] += total;
      row.total += total;
      byClient.set(name, row);
    });

    let arr = Array.from(byClient.values()).sort((a, b) => b.total - a.total);

    // If **single client** filter is active, force the label to the selected client name
    if (clientId) {
      const label = selectedClientLabel;
      const merged = arr.reduce(
        (acc, r) => {
          acc.current += r.current;
          acc.d30 += r.d30;
          acc.d60 += r.d60;
          acc.d90 += r.d90;
          acc.d120 += r.d120;
          acc.total += r.total;
          return acc;
        },
        { client: label, current: 0, d30: 0, d60: 0, d90: 0, d120: 0, total: 0 }
      );
      arr = merged.total ? [merged] : [];
    }

    return arr;
  };

  const apply = async () => {
    setLoading(true);
    setErr("");
    try {
      // --- REVENUE ---
      const invs = await fetchAllInvoices({
        date_from: dateFrom,
        date_to: dateTo,
        status,
        client_id: clientId || undefined,
        sort: "invoice_date",
        order: "asc",
      });
      setInvoicesCache(invs);

      const revRows = invs.map((i) => ({
        date: fmtDate(i.invoice_date),
        subtotal: toNumber(i.subtotal),
        discount: toNumber(i.discount_amount),
        tax: toNumber(i.tax_amount),
        total: toNumber(i.total),
      }));
      const sum = revRows.reduce(
        (a, r) => ({
          invoices: a.invoices + 1,
          subtotal: a.subtotal + r.subtotal,
          discount: a.discount + r.discount,
          tax: a.tax + r.tax,
          total: a.total + r.total,
        }),
        { invoices: 0, subtotal: 0, discount: 0, tax: 0, total: 0 }
      );
      setRevenueRows(revRows);
      setRevenueSummary({ ...sum, avg: sum.invoices ? sum.total / sum.invoices : 0 });

      // --- AGING ---
      setAgingRows(buildAging(invs));
      setAgingAsOf(todayISO());

      // --- TOP CLIENTS (try API; else fallback) ---
      try {
        const yFrom = new Date(dateFrom).getFullYear();
        const yTo = new Date(dateTo).getFullYear();
        let rows = await getTopClients({ year_from: yFrom, year_to: yTo, limit: 10 });
        if (clientId) {
          const c = clientsById.get(clientId);
          const name = c?.name || c?.company;
          if (name) rows = rows.filter((r) => r.client === name);
        }
        const grand = rows.reduce((a, r) => a + toNumber(r.Paid), 0) || 1;
        rows = rows.map((r) => ({ ...r, pct: (toNumber(r.Paid) / grand) * 100 }));
        setTopRows(rows);
      } catch {
        const byClientPaid = new Map();
        invs.forEach((i) => {
          const fromMap = clientsById.get(i.client_id);
          const name = fromMap?.name || fromMap?.company || i.client?.name || i.client?.company || "Unknown";
          const total = toNumber(i.total);
          byClientPaid.set(name, (byClientPaid.get(name) || 0) + total);
        });
        let rows = Array.from(byClientPaid.entries())
          .map(([client, Paid]) => ({ client, Paid, Outstanding: 0, Overdue: 0, Total: Paid }))
          .sort((a, b) => b.Paid - a.Paid)
          .slice(0, 10);
        if (clientId) {
          const label = selectedClientLabel;
          const mergedPaid = rows.reduce((a, r) => a + r.Paid, 0);
          rows = mergedPaid ? [{ client: label, Paid: mergedPaid, Outstanding: 0, Overdue: 0, Total: mergedPaid }] : [];
        }
        const grand = rows.reduce((a, r) => a + toNumber(r.Paid), 0) || 1;
        setTopRows(rows.map((r) => ({ ...r, pct: (toNumber(r.Paid) / grand) * 100 })));
      }
    } catch (e) {
      console.error(e);
      setErr("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  // Load once with defaults
  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If clients arrive after invoices, rebuild aging rows to swap “Unknown” -> real names
  useEffect(() => {
    if (invoicesCache.length) {
      setAgingRows(buildAging(invoicesCache));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  /** CSV exports */
  const exportRevenue = () => {
    const rows = [
      ["Date", "Subtotal", "Discount", "Tax", "Total"],
      ...revenueRows.map((r) => [r.date, r.subtotal, r.discount, r.tax, r.total]),
      [],
      ["Invoices", revenueSummary.invoices],
      ["Subtotal", revenueSummary.subtotal],
      ["Discount", revenueSummary.discount],
      ["Tax", revenueSummary.tax],
      ["Total", revenueSummary.total],
      ["Average Invoice", revenueSummary.avg],
    ];
    downloadCSV(`revenue_${dateFrom}_${dateTo}.csv`, rows);
  };

  const exportAging = () => {
    const rows = [
      ["Client", ...BUCKETS.map((b) => b.label), "Total"],
      ...agingRows.map((r) => [r.client, r.current, r.d30, r.d60, r.d90, r.d120, r.total]),
    ];
    downloadCSV(`aging_${agingAsOf}.csv`, rows);
  };

  const exportTop = () => {
    const rows = [
      ["Client", "Paid", "% of Total"],
      ...topRows.map((r) => [r.client, toNumber(r.Paid), `${r.pct.toFixed(1)}%`]),
    ];
    downloadCSV(`top_clients_${dateFrom}_${dateTo}.csv`, rows);
  };

  const quickSet = (key) => {
    const p = rangePresets()[key];
    setDateFrom(p.from);
    setDateTo(p.to);
  };

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 14mm; }
          nav, header, .no-print { display: none !important; }
          .print-container { padding: 0; }
          .print-title { display: block !important; margin-bottom: 8px; }
          table { page-break-inside: auto; table-layout: fixed; width: 100%; }
          th, td { white-space: nowrap; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
        @media screen {
          .print-title { display: none; }
        }
      `}</style>

      {/* Screen header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-gray-500">Printable snapshots and CSV exports.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50"
        >
          Print
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg shadow-sm p-4 no-print">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-56"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.company || "(Unnamed)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="INVOICE">INVOICE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="VOID">VOID</option>
            </select>
          </div>
          <div className="ml-auto flex gap-2">
            <div className="flex gap-1">
              <button onClick={() => quickSet("THIS_MONTH")} className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" type="button">This Month</button>
              <button onClick={() => quickSet("LAST_MONTH")} className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" type="button">Last Month</button>
              <button onClick={() => quickSet("QTD")} className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" type="button">QTD</button>
              <button onClick={() => quickSet("YTD")} className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50" type="button">YTD</button>
            </div>
            <button
              onClick={apply}
              disabled={loading}
              className={`px-3 py-2 text-sm rounded text-white ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}
              type="button"
              title="Apply filters"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>

        {/* concise, single-line context */}
        <div className="text-xs text-gray-500 mt-2">
          Range: <strong>{dateFrom}</strong> → <strong>{dateTo}</strong>
          {" • "}Client: <strong>{selectedClientLabel}</strong>
          {" • "}Status: <strong>{status}</strong>
        </div>
      </div>

      {/* Print header (only in print) */}
      <div className="print-title">
        <h2 className="text-xl font-semibold">Reports</h2>
        <div className="text-xs text-gray-600">
          Range: <strong>{dateFrom}</strong> → <strong>{dateTo}</strong>
          {" • "}Client: <strong>{selectedClientLabel}</strong>
          {" • "}Status: <strong>{status}</strong>
          {" • "}As of: <strong>{agingAsOf}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print">
        <div className="flex gap-2">
          {[
            { key: "revenue", label: "Revenue" },
            { key: "aging", label: "Aging" },
            { key: "top", label: "Top Clients" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded border text-sm ${tab === t.key ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"}`}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {err}
        </div>
      )}

      {/* CONTENT */}
      <div className="print-container">
        {tab === "revenue" && (
          <section className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Revenue Summary</h3>
              <button onClick={exportRevenue} className="no-print px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50">
                Export CSV
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <KPI label="Invoices" value={revenueSummary.invoices} />
              <KPI label="Subtotal" value={fmtMoney(revenueSummary.subtotal)} />
              <KPI label="Discount" value={fmtMoney(revenueSummary.discount)} />
              <KPI label="Tax" value={fmtMoney(revenueSummary.tax)} />
              <KPI label="Total" value={fmtMoney(revenueSummary.total)} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="py-2 px-3 text-left whitespace-nowrap">Date</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Subtotal</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Discount</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Tax</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">No data.</td>
                    </tr>
                  )}
                  {revenueRows.map((r, idx) => (
                    <tr key={idx} className="border-b last:border-none">
                      <td className="py-2 px-3">{r.date}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.subtotal)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.discount)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.tax)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                {revenueRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="py-2 px-3 text-right">Totals:</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(revenueSummary.subtotal)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(revenueSummary.discount)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(revenueSummary.tax)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(revenueSummary.total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}

        {tab === "aging" && (
          <section className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold">
                Aging <span className="text-gray-500 text-sm">(as of {agingAsOf})</span>
              </h3>
              <button onClick={exportAging} className="no-print px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50">
                Export CSV
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Buckets based on invoice <em>due date</em>.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="py-2 px-3 text-left whitespace-nowrap">Client</th>
                    {BUCKETS.map((b) => (
                      <th key={b.key} className="py-2 px-3 text-right whitespace-nowrap">{b.label}</th>
                    ))}
                    <th className="py-2 px-3 text-right whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">No data.</td>
                    </tr>
                  )}
                  {agingRows.map((r) => (
                    <tr key={r.client} className="border-b last:border-none">
                      <td className="py-2 px-3">{clientId ? selectedClientLabel : r.client}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.current)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.d30)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.d60)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.d90)}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.d120)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                {agingRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="py-2 px-3 text-right">Totals:</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(agingRows.reduce((a, r) => a + r.current, 0))}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(agingRows.reduce((a, r) => a + r.d30, 0))}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(agingRows.reduce((a, r) => a + r.d60, 0))}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(agingRows.reduce((a, r) => a + r.d90, 0))}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(agingRows.reduce((a, r) => a + r.d120, 0))}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(agingRows.reduce((a, r) => a + r.total, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}

        {tab === "top" && (
          <section className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Top Clients</h3>
              <button onClick={exportTop} className="no-print px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50">
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="py-2 px-3 text-left whitespace-nowrap">Client</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Paid</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500">No data.</td>
                    </tr>
                  )}
                  {topRows.map((r) => (
                    <tr key={r.client} className="border-b last:border-none">
                      <td className="py-2 px-3">{clientId ? selectedClientLabel : r.client}</td>
                      <td className="py-2 px-3 text-right">{fmtMoney(r.Paid)}</td>
                      <td className="py-2 px-3 text-right">{r.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** small card */
function KPI({ label, value }) {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
