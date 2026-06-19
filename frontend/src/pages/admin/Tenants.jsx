import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Plus, RefreshCw, Search, AlertCircle } from "lucide-react";
import { listTenants } from "../../api/admin";

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
      ${active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {active ? "Active" : "Suspended"}
    </span>
  );
}

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTenants(await listTenants());
    } catch {
      setError("Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t =>
      t.company_name.toLowerCase().includes(q) ||
      t.db_name.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      t.users.some(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [tenants, search]);

  const active = tenants.filter(t => t.status === "active").length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tenants</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {tenants.length} total · {active} active · {tenants.length - active} suspended
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw size={14} />
          </button>
          <Link
            to="/admin/tenants/new"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
          >
            <Plus size={16} /> New tenant
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by company, username, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Building2 size={36} className="mb-3 opacity-25" />
            <p className="text-sm">{search ? "No results found." : "No tenants yet."}</p>
            {!search && (
              <Link to="/admin/tenants/new" className="mt-3 text-sm text-emerald-600 hover:underline">
                Create the first one
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["#", "Company", "Database", "Users", "Status", "Created", "Updated"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/admin/tenants/${t.id}`)}
                  className="hover:bg-emerald-50/40 cursor-pointer transition group"
                >
                  <td className="px-4 py-3.5 text-gray-400 text-xs font-mono">{t.id}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900 group-hover:text-emerald-700 transition">{t.company_name}</div>
                    {t.users[0] && (
                      <div className="text-xs text-gray-400 mt-0.5">{t.users[0].email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-400">{t.db_name}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {t.users.length}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                    {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400 text-right">
          Showing {filtered.length} of {tenants.length} tenants
        </p>
      )}
    </div>
  );
}
