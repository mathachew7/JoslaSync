import { useState, useEffect } from "react";
import { Edit, Trash2, Eye, ChevronDown, ChevronUp, Search } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const sampleInvoices = [
  { id: "INV-001", client: "John Doe", date: "2025-07-15", amount: 1200, status: "Paid" },
  { id: "INV-002", client: "Jane Smith", date: "2025-07-10", amount: 800, status: "Outstanding" },
  { id: "INV-003", client: "Lucy Brown", date: "2025-06-30", amount: 1500, status: "Overdue" },
  { id: "INV-004", client: "Mark Allen", date: "2024-12-12", amount: 500, status: "Paid" },
  { id: "INV-005", client: "Olivia White", date: "2024-10-05", amount: 650, status: "Outstanding" },
  { id: "INV-006", client: "Ethan Wilson", date: "2023-08-20", amount: 400, status: "Paid" },
  { id: "INV-007", client: "Sophia Taylor", date: "2022-11-10", amount: 950, status: "Outstanding" },
  { id: "INV-008", client: "James Lee", date: "2021-06-18", amount: 1300, status: "Overdue" },
  { id: "INV-009", client: "Emma Harris", date: "2020-04-02", amount: 2000, status: "Paid" },
  { id: "INV-010", client: "Tom Clark", date: "2020-02-15", amount: 850, status: "Outstanding" },
];

const COLORS = {
  Paid: "#6ee7b7",
  Outstanding: "#93c5fd",
  Overdue: "#fca5a5",
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCharts, setShowCharts] = useState(true);
  const [startYear, setStartYear] = useState("2020");
  const [endYear, setEndYear] = useState("2025");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("invoices"));
    if (stored && stored.length > 0) {
      setInvoices(stored);
    } else {
      setInvoices(sampleInvoices);
      localStorage.setItem("invoices", JSON.stringify(sampleInvoices));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("invoices", JSON.stringify(invoices));
  }, [invoices]);

  // Auto-correct the year range if reversed
  useEffect(() => {
    if (parseInt(startYear) > parseInt(endYear)) {
      const temp = startYear;
      setStartYear(endYear);
      setEndYear(temp);
    }
  }, [startYear, endYear]);

  // Stats
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter((i) => i.status === "Paid").length;
  const outstandingInvoices = invoices.filter((i) => i.status === "Outstanding").length;
  const overdueInvoices = invoices.filter((i) => i.status === "Overdue").length;

  // Bar Chart Data
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const selectedYears = [startYear, endYear].sort((a, b) => parseInt(a) - parseInt(b));

  const barData = months.map((month) => {
    const totals = { month, Paid: 0, Outstanding: 0, Overdue: 0 };
    invoices.forEach((i) => {
      const date = new Date(i.date);
      const monthName = date.toLocaleString("default", { month: "short" });
      const year = date.getFullYear();
      if (
        monthName === month &&
        year >= parseInt(selectedYears[0]) &&
        year <= parseInt(selectedYears[1])
      ) {
        totals[i.status] += i.amount;
      }
    });
    return totals;
  });

  // Top Clients (same as before)
  const clientTotals = invoices.reduce((acc, inv) => {
    if (!acc[inv.client]) {
      acc[inv.client] = { Paid: 0, Outstanding: 0, Overdue: 0, Total: 0 };
    }
    acc[inv.client][inv.status] += inv.amount;
    acc[inv.client].Total += inv.amount;
    return acc;
  }, {});
  const topClients = Object.entries(clientTotals)
    .map(([client, data]) => ({ client, ...data }))
    .sort((a, b) => b.Total - a.Total)
    .slice(0, 5);

  // Search + sort invoices
  const filteredInvoices = invoices
    .filter(
      (i) =>
        i.id.toLowerCase().includes(search.toLowerCase()) ||
        i.client.toLowerCase().includes(search.toLowerCase()) ||
        i.status.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Pagination
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleDelete = (id) => {
    setInvoices(invoices.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Total Invoices</h3>
          <p className="text-2xl font-bold">{totalInvoices}</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Paid</h3>
          <p className="text-2xl font-bold text-green-500">{paidInvoices}</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Outstanding</h3>
          <p className="text-2xl font-bold text-blue-500">{outstandingInvoices}</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Overdue</h3>
          <p className="text-2xl font-bold text-red-500">{overdueInvoices}</p>
        </div>
      </div>

      {/* Charts Toggle */}
      <button
        onClick={() => setShowCharts(!showCharts)}
        className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
      >
        {showCharts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showCharts ? "Hide Insights" : "Show Insights"}
      </button>

      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Invoice Totals by Month</h3>
              <div className="flex space-x-2">
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {[...new Set(invoices.map((i) => new Date(i.date).getFullYear()))]
                    .sort()
                    .map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="border p-1 rounded text-sm"
                >
                  {[...new Set(invoices.map((i) => new Date(i.date).getFullYear()))]
                    .sort()
                    .map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                </select>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Paid" stackId="a" fill={COLORS.Paid} />
                <Bar dataKey="Outstanding" stackId="a" fill={COLORS.Outstanding} />
                <Bar dataKey="Overdue" stackId="a" fill={COLORS.Overdue} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Clients Panel */}
          <div className="bg-white shadow rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-4">Top Clients by Invoice Value</h3>
            <div className="space-y-3">
              {topClients.map((c, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg shadow-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.client}</span>
                    <span className="font-semibold">${c.Total.toLocaleString()}</span>
                  </div>
                  <div className="flex h-2 rounded overflow-hidden mt-2">
                    <div style={{ width: `${(c.Paid / c.Total) * 100}%`, background: COLORS.Paid }}></div>
                    <div style={{ width: `${(c.Outstanding / c.Total) * 100}%`, background: COLORS.Outstanding }}></div>
                    <div style={{ width: `${(c.Overdue / c.Total) * 100}%`, background: COLORS.Overdue }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center border rounded px-2 py-1 bg-white shadow-sm w-full sm:w-64">
        <Search size={18} className="text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Search invoices..."
          className="outline-none text-sm flex-1"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {/* Invoice Table */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Invoice ID</th>
              <th className="py-2 px-3 text-left">Client</th>
              <th className="py-2 px-3 text-left">Date</th>
              <th className="py-2 px-3 text-left">Amount ($)</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-b last:border-none hover:bg-gray-50 transition">
                <td className="py-2 px-3">{invoice.id}</td>
                <td className="py-2 px-3">{invoice.client}</td>
                <td className="py-2 px-3">{invoice.date}</td>
                <td className="py-2 px-3">${invoice.amount.toLocaleString()}</td>
                <td className="py-2 px-3">{invoice.status}</td>
                <td className="py-2 px-3 text-right">
                  <button className="text-blue-500 hover:text-blue-700 mr-3">
                    <Eye size={18} />
                  </button>
                  <button className="text-blue-500 hover:text-blue-700 mr-3">
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className={`px-4 py-1 text-sm rounded ${page === 1 ? "bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          >
            Previous
          </button>
          <p className="text-gray-500">Page {page} of {totalPages}</p>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className={`px-4 py-1 text-sm rounded ${page === totalPages ? "bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
