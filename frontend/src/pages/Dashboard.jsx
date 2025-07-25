import { useState, useEffect } from "react";
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

const lineDataAll = {
  "2025": {
    Jan: { invoices: 12, paid: 8, outstanding: 3, overdue: 1 },
    Feb: { invoices: 19, paid: 10, outstanding: 6, overdue: 3 },
    Mar: { invoices: 15, paid: 11, outstanding: 3, overdue: 1 },
    Apr: { invoices: 23, paid: 18, outstanding: 4, overdue: 1 },
    May: { invoices: 17, paid: 12, outstanding: 4, overdue: 1 },
    Jun: { invoices: 10, paid: 6, outstanding: 3, overdue: 1 },
    Jul: { invoices: 20, paid: 15, outstanding: 4, overdue: 1 },
  },
  "2024": {
    Jan: { invoices: 8, paid: 6, outstanding: 10, overdue: 10 },
    Feb: { invoices: 14, paid: 9, outstanding: 3, overdue: 2 },
    Mar: { invoices: 12, paid: 7, outstanding: 4, overdue: 1 },
    Apr: { invoices: 18, paid: 13, outstanding: 4, overdue: 1 },
    May: { invoices: 11, paid: 7, outstanding: 3, overdue: 1 },
    Jun: { invoices: 7, paid: 4, outstanding: 2, overdue: 1 },
    Jul: { invoices: 15, paid: 10, outstanding: 4, overdue: 1 },
  },
};

const availableYears = Object.keys(lineDataAll).sort((a, b) => b - a);

// Colors for Pie Chart (Green, Blue, Red)
const COLORS = ["#6ee7b7", "#93c5fd", "#fca5a5"];
const LINE_COLOR = "#3b82f6";

export default function Dashboard() {
  const [startYear, setStartYear] = useState("2024");
  const [endYear, setEndYear] = useState("2025");
  const [selectedMonth, setSelectedMonth] = useState("All");

  // Auto-correct year range dynamically
  useEffect(() => {
    if (parseInt(startYear) > parseInt(endYear)) {
      setStartYear(endYear);
      setEndYear(startYear);
    }
  }, [startYear, endYear]);

  // Selected years in ascending order
  const selectedYears = availableYears
    .filter(
      (year) =>
        parseInt(year) >= Math.min(parseInt(startYear), parseInt(endYear)) &&
        parseInt(year) <= Math.max(parseInt(startYear), parseInt(endYear))
    )
    .sort((a, b) => parseInt(a) - parseInt(b));

  // Build aggregated line chart data (months only, totals across years)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const lineData = months
    .filter((m) => selectedMonth === "All" || m === selectedMonth)
    .map((month) => {
      let total = 0;
      selectedYears.forEach((year) => {
        if (lineDataAll[year][month]) {
          total += lineDataAll[year][month].invoices;
        }
      });
      return { month, invoices: total };
    });

  // Pie chart totals
  const totals = { paid: 0, outstanding: 0, overdue: 0 };
  selectedYears.forEach((year) => {
    Object.keys(lineDataAll[year])
      .filter((m) => selectedMonth === "All" || m === selectedMonth)
      .forEach((month) => {
        totals.paid += lineDataAll[year][month].paid;
        totals.outstanding += lineDataAll[year][month].outstanding;
        totals.overdue += lineDataAll[year][month].overdue;
      });
  });

  const pieData = [
    { name: "Paid", value: totals.paid },
    { name: "Outstanding", value: totals.outstanding },
    { name: "Overdue", value: totals.overdue },
  ];

  return (
    <div className="space-y-8">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Total Invoices</h3>
          <p className="text-2xl font-bold" style={{ color: "black" }}>
            120
          </p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Total Paid</h3>
          <p className="text-2xl font-bold text-green-500">$42,300</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Outstanding Balance</h3>
          <p className="text-2xl font-bold text-blue-500">$8,500</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Overdue Invoices</h3>
          <p className="text-2xl font-bold text-red-500">5</p>
        </div>
        <div className="p-5 bg-white shadow rounded-lg text-center">
          <h3 className="text-gray-500 text-sm">Number of Clients</h3>
          <p className="text-2xl font-bold text-purple-500">18</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-white shadow rounded-lg p-5">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <h3 className="text-lg font-semibold">Invoices Over Time</h3>
            <div className="flex space-x-2">
              {/* Start Year */}
              <select
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="border p-1 rounded text-sm"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {/* End Year */}
              <select
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                className="border p-1 rounded text-sm"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {/* Month Filter */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border p-1 rounded text-sm"
              >
                <option value="All">All</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={lineData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="invoices"
                stroke={"black"}
                strokeWidth={3}
                dot={{ r: 5, stroke: "black" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white shadow rounded-lg p-5">
          <h3 className="text-lg font-semibold mb-4">Invoice Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={85}
                label
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Recent Invoices Table */}
      <div className="bg-white shadow rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Recent Invoices</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Client</th>
              <th className="py-2">Status</th>
              <th className="py-2">Date</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">Acme Corp</td>
              <td className="py-2 text-green-500">Paid</td>
              <td className="py-2">2025-07-01</td>
              <td className="py-2 text-right">$1,200</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Beta LLC</td>
              <td className="py-2 text-blue-500">Outstanding</td>
              <td className="py-2">2025-07-10</td>
              <td className="py-2 text-right">$800</td>
            </tr>
            <tr>
              <td className="py-2">Omega Inc</td>
              <td className="py-2 text-red-500">Overdue</td>
              <td className="py-2">2025-06-25</td>
              <td className="py-2 text-right">$500</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
