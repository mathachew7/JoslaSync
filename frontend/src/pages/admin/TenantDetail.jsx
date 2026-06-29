import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, AlertCircle, CheckCircle2, XCircle,
  KeyRound, User, Copy, Check, RefreshCw, X, Loader2,
  ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import {
  getTenant, updateTenantStatus, resetUserPassword,
  getTenantFeatures, updateTenantFeature,
} from "../../api/admin";

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset
      ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-red-50 text-red-700 ring-red-600/20"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset
      ${role === "super_admin"
        ? "bg-blue-50 text-blue-700 ring-blue-600/20"
        : "bg-gray-100 text-gray-600 ring-gray-500/20"}`}>
      {role.replace("_", " ")}
    </span>
  );
}

const FEATURE_META = [
  {
    key: "draft_invoices",
    label: "Draft Invoices",
    desc: "Allow tenant to save invoices as draft before issuing",
  },
  {
    key: "recurring_invoices",
    label: "Recurring Invoices",
    desc: "Schedule invoices to auto-generate on a repeat cycle",
  },
  {
    key: "multi_user",
    label: "Multi-User (Team)",
    desc: "Allow tenant admin to invite and manage team members",
  },
  {
    key: "email_reminders",
    label: "Email Reminders",
    desc: "Allow automated overdue payment reminder emails",
  },
];

function FeatureToggle({ featureKey, label, desc, enabled, onToggle, saving }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onToggle(featureKey, !enabled)}
        disabled={saving === featureKey}
        className="relative shrink-0 transition-opacity disabled:opacity-50"
        title={enabled ? "Click to disable" : "Click to enable"}
      >
        {saving === featureKey ? (
          <Loader2 size={22} className="animate-spin text-gray-400" />
        ) : enabled ? (
          <ToggleRight size={28} className="text-blue-600" />
        ) : (
          <ToggleLeft size={28} className="text-gray-400" />
        )}
      </button>
    </div>
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
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-amber-500" />
            <span className="font-semibold text-gray-800 text-sm">Reset password</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-5">
          {!result ? (
            <>
              <p className="text-sm text-gray-600 mb-1">
                Resetting password for <b>{user.username}</b>.
              </p>
              <p className="text-xs text-gray-400 mb-5">
                A temporary password will be generated. User must change it on next login.
              </p>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={doReset}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 py-2 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={13} className="animate-spin" /> Resetting…</> : <><RefreshCw size={13} /> Reset</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={17} className="text-emerald-500" />
                <p className="text-sm font-medium text-gray-800">Password reset successfully</p>
              </div>
              <p className="text-xs text-gray-500 mb-2">New temporary password:</p>
              <div className="flex items-center gap-2 mb-4">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono text-gray-800 tracking-wider">
                  {result.temp_password}
                </code>
                <button
                  onClick={copy}
                  className={`h-[46px] w-11 rounded-lg border flex items-center justify-center shrink-0 transition
                    ${copied ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5">
                User must change this on first login.
              </p>
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-gray-900 hover:bg-gray-700 py-2.5 text-sm font-semibold text-white"
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
  const [tenant,      setTenant]      = useState(null);
  const [features,    setFeatures]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [toggling,    setToggling]    = useState(false);
  const [savingFeat,  setSavingFeat]  = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [tab,         setTab]         = useState("users");

  useEffect(() => {
    (async () => {
      try {
        const [t, f] = await Promise.all([
          getTenant(Number(id)),
          getTenantFeatures(Number(id)),
        ]);
        setTenant(t);
        setFeatures(f);
      } catch {
        setError("Failed to load tenant.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleStatus = async () => {
    if (!tenant) return;
    setToggling(true);
    try {
      setTenant(await updateTenantStatus(tenant.id, tenant.status === "active" ? "suspended" : "active"));
    } catch {
      setError("Failed to update status.");
    } finally {
      setToggling(false);
    }
  };

  const handleFeatureToggle = async (featureKey, enabled) => {
    setSavingFeat(featureKey);
    try {
      setFeatures(await updateTenantFeature(tenant.id, featureKey, enabled));
    } catch {
      setError("Failed to update feature.");
    } finally {
      setSavingFeat(null);
    }
  };

  const handleResetDone = useCallback((updatedUser) => {
    setTenant(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === updatedUser.id ? updatedUser : u),
    }));
  }, []);

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center animate-pulse">Loading…</div>;

  if (error || !tenant) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm max-w-lg mx-auto mt-10">
        <AlertCircle size={15} /> {error || "Tenant not found."}
      </div>
    );
  }

  const isActive = tenant.status === "active";
  const TABS = [
    { key: "users",    label: "Users",    icon: User },
    { key: "features", label: "Features", icon: Zap },
  ];

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
            <h1 className="text-xl font-semibold text-gray-900 truncate">{tenant.company_name}</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{tenant.db_name}</p>
          </div>
          <button
            onClick={toggleStatus}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition border disabled:opacity-50
              ${isActive
                ? "bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200"}`}
          >
            {toggling ? <Loader2 size={14} className="animate-spin" /> : isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
            {isActive ? "Suspend" : "Activate"}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Status",  value: <StatusBadge active={isActive} /> },
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

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === "users" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {tenant.users.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No users in this tenant.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    {["Username", "Email", "Role", "Status", "Password", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenant.users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3"><StatusBadge active={u.is_active} /></td>
                      <td className="px-4 py-3">
                        {u.must_change_password ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <KeyRound size={11} /> Temp
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Own</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setResetTarget(u)}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition ml-auto"
                        >
                          <RefreshCw size={11} /> Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Features tab */}
        {tab === "features" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Feature Flags</p>
              <p className="text-xs text-gray-500 mt-0.5">Toggle which features are available to this tenant.</p>
            </div>
            <div className="px-5">
              {features ? (
                FEATURE_META.map(({ key, label, desc }) => (
                  <FeatureToggle
                    key={key}
                    featureKey={key}
                    label={label}
                    desc={desc}
                    enabled={features[key] ?? true}
                    onToggle={handleFeatureToggle}
                    saving={savingFeat}
                  />
                ))
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">Loading features…</div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
