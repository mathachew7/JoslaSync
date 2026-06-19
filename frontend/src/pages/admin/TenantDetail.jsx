import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, AlertCircle, CheckCircle2, XCircle,
  KeyRound, User, Copy, Check, RefreshCw, X, Loader2,
} from "lucide-react";
import { getTenant, updateTenantStatus, resetUserPassword } from "../../api/admin";

function Badge({ label, color }) {
  const styles = {
    green:  "bg-emerald-100 text-emerald-700",
    red:    "bg-red-100 text-red-600",
    amber:  "bg-amber-100 text-amber-700",
    gray:   "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[color] || styles.gray}`}>
      {label}
    </span>
  );
}

function ResetModal({ user, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const doReset = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await resetUserPassword(user.id);
      setResult(r);
      onDone(r.user);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result.temp_password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-amber-500" />
            <span className="font-semibold text-gray-800 text-sm">Reset password</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {!result ? (
            <>
              <p className="text-sm text-gray-600 mb-1">
                Resetting password for <span className="font-semibold text-gray-800">{user.username}</span>.
              </p>
              <p className="text-sm text-gray-400 mb-5">
                A new temporary password will be generated. The user will be forced to change it on next login.
              </p>

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={doReset}
                  disabled={loading}
                  className={`flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Resetting…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} /> Generate & reset
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <p className="text-sm font-medium text-gray-800">Password reset successfully</p>
              </div>

              <p className="text-xs text-gray-500 mb-2">New temporary password — copy it now, it won't be shown again:</p>

              <div className="flex items-center gap-2 mb-4">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-800 tracking-wider">
                  {result.temp_password}
                </code>
                <button
                  onClick={copy}
                  className={`flex items-center justify-center h-[46px] w-11 rounded-xl border transition shrink-0
                    ${copied ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5">
                The user must change this on first login. Once they do, it's gone.
              </p>

              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TenantDetail() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setTenant(await getTenant(Number(id)));
      } catch {
        setError("Failed to load tenant.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleStatus = async () => {
    if (!tenant) return;
    const next = tenant.status === "active" ? "suspended" : "active";
    setToggling(true);
    try {
      setTenant(await updateTenantStatus(tenant.id, next));
    } catch {
      setError("Failed to update status.");
    } finally {
      setToggling(false);
    }
  };

  // Update the user row in tenant state after password reset
  const handleResetDone = useCallback((updatedUser) => {
    setTenant(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === updatedUser.id ? updatedUser : u),
    }));
  }, []);

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading…</div>;

  if (error || !tenant) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm max-w-lg mx-auto mt-10">
        <AlertCircle size={16} /> {error || "Tenant not found."}
      </div>
    );
  }

  const isActive = tenant.status === "active";

  return (
    <>
      {resetTarget && (
        <ResetModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={handleResetDone}
        />
      )}

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin/tenants" className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{tenant.company_name}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{tenant.db_name}</p>
          </div>
          <button
            onClick={toggleStatus}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition border
              ${isActive
                ? "bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200"
              } ${toggling ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
            {isActive ? "Suspend" : "Activate"}
          </button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Status",  value: <Badge label={tenant.status} color={isActive ? "green" : "red"} /> },
            { label: "Users",   value: tenant.users.length },
            { label: "Created", value: new Date(tenant.created_at).toLocaleDateString() },
            { label: "Updated", value: tenant.updated_at ? new Date(tenant.updated_at).toLocaleDateString() : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <div className="text-sm font-semibold text-gray-800">{value}</div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <User size={15} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Users</span>
          </div>

          {tenant.users.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No users in this tenant.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Username", "Email", "Role", "Status", "Password", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenant.users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge label={u.role.replace("_", " ")} color={u.role === "super_admin" ? "green" : "gray"} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={u.is_active ? "Active" : "Inactive"} color={u.is_active ? "green" : "red"} />
                    </td>
                    <td className="px-4 py-3">
                      {u.must_change_password ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <KeyRound size={11} /> Temp password set
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Own password</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setResetTarget(u)}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition ml-auto"
                      >
                        <RefreshCw size={11} /> Reset password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
