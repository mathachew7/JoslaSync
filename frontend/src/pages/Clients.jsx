import { useState, useEffect } from "react";
import { Edit, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
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

const sampleClients = [
  { id: 1, name: "John Doe", email: "john@example.com", phone: "+1 555-123-4567", company: "Dream Builders", joined: "2025-07-10", invoices: 12000, status: "Active" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", phone: "+1 555-987-6543", company: "Skyline Corp", joined: "2025-07-12", invoices: 8500, status: "Active" },
  { id: 3, name: "Mark Allen", email: "mark@example.com", phone: "+1 555-456-7890", company: "Urban Works", joined: "2024-12-05", invoices: 5600, status: "Deactivated" },
  { id: 4, name: "Lucy Brown", email: "lucy@example.com", phone: "+1 555-321-6789", company: "Peak Horizons", joined: "2024-08-30", invoices: 13000, status: "Active" },
  { id: 5, name: "Tom Clark", email: "tom@example.com", phone: "+1 555-654-3210", company: "Greenway Inc", joined: "2023-06-28", invoices: 2000, status: "Blacklisted" },
  { id: 6, name: "Olivia White", email: "olivia@example.com", phone: "+1 555-777-8888", company: "Bright Homes", joined: "2023-03-02", invoices: 9400, status: "Active" },
  { id: 7, name: "Ethan Wilson", email: "ethan@example.com", phone: "+1 555-333-2222", company: "City Makers", joined: "2022-11-15", invoices: 4700, status: "Active" },
  { id: 8, name: "Sophia Taylor", email: "sophia@example.com", phone: "+1 555-111-9999", company: "BuildRight LLC", joined: "2021-09-01", invoices: 7100, status: "Active" },
  { id: 9, name: "James Lee", email: "james@example.com", phone: "+1 555-444-7777", company: "Vision Realty", joined: "2020-04-20", invoices: 3500, status: "Deactivated" },
  { id: 10, name: "Emma Harris", email: "emma@example.com", phone: "+1 555-888-4444", company: "Structura Ltd", joined: "2020-01-18", invoices: 15000, status: "Active" },
];

const STATUS_COLORS = ["#6ee7b7", "#93c5fd", "#fca5a5"];

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCharts, setShowCharts] = useState(true);
  const [startYear, setStartYear] = useState("2020");
  const [endYear, setEndYear] = useState("2025");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("clients"));
    if (stored && stored.length > 0) {
      setClients(stored);
    } else {
      setClients(sampleClients);
      localStorage.setItem("clients", JSON.stringify(sampleClients));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("clients", JSON.stringify(clients));
  }, [clients]);

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === "Active").length;
  const deactivatedClients = clients.filter((c) => c.status === "Deactivated").length;
  const blacklistedClients = clients.filter((c) => c.status === "Blacklisted").length;

  const pieData = [
    { name: "Active", value: activeClients },
    { name: "Deactivated", value: deactivatedClients },
    { name: "Blacklisted", value: blacklistedClients },
  ];

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const selectedYears = [startYear, endYear].sort((a, b) => parseInt(a) - parseInt(b));
  const lineData = months.map((month) => {
    const totalForMonth = clients.filter((c) => {
      const joined = new Date(c.joined);
      const monthName = joined.toLocaleString("default", { month: "short" });
      const year = joined.getFullYear();
      return (
        monthName === month &&
        year >= parseInt(selectedYears[0]) &&
        year <= parseInt(selectedYears[1])
      );
    }).length;
    return { month, clients: totalForMonth };
  });

  const filteredClients = [...clients]
    .filter(
      (client) =>
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.company.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.joined) - new Date(a.joined));

  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleDelete = (id) => {
    setClients(clients.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
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

      {/* Toggle Charts */}
      <button
        onClick={() => setShowCharts(!showCharts)}
        className="flex items-center gap-2 text-blue-600 text-sm hover:underline"
      >
        {showCharts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showCharts ? "Hide Charts" : "Show Charts"}
      </button>

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
                  {[...new Set(clients.map((c) => new Date(c.joined).getFullYear()))]
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
                  {[...new Set(clients.map((c) => new Date(c.joined).getFullYear()))]
                    .sort()
                    .map((year) => (
                      <option key={year} value={year}>{year}</option>
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
            <h3 className="text-lg font-semibold mb-4">Clients by Status</h3>
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

      {/* Search */}
      <div className="flex items-center border rounded px-2 py-1 bg-white shadow-sm w-full sm:w-64">
        <Search size={18} className="text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Search clients..."
          className="outline-none text-sm flex-1"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {/* Paginated Table */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Email</th>
              <th className="py-2 px-3 text-left">Phone</th>
              <th className="py-2 px-3 text-left">Company</th>
              <th className="py-2 px-3 text-left">Joined</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClients.map((client) => (
              <tr
                key={client.id}
                className="border-b last:border-none hover:bg-gray-50 transition"
              >
                <td className="py-2 px-3">{client.name}</td>
                <td className="py-2 px-3">{client.email}</td>
                <td className="py-2 px-3">{client.phone}</td>
                <td className="py-2 px-3">{client.company}</td>
                <td className="py-2 px-3">{client.joined}</td>
                <td className="py-2 px-3">{client.status}</td>
                <td className="py-2 px-3 text-right">
                  <button className="text-blue-500 hover:text-blue-700 mr-3">
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
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
