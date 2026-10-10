import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, AlertCircle, CheckCircle2, XCircle,
  KeyRound, User, Copy, Check, RefreshCw, X, Loader2,
  ToggleLeft, ToggleRight, Zap, Eye, EyeOff, Pencil, Archive, ArchiveRestore,
  UserPlus, Building2, Users as UsersIcon, Calendar, Clock,
} from "lucide-react";
import {
  getTenant, updateTenantStatus, updateTenantName, addTenantUser, resetUserPassword,
  getTenantFeatures, updateTenantFeature,
} from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../utils/parseApiError";

function generatePassword(len = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  const arr = Array.from({ length: len }, (_, i) => {
    if (i === 0) return upper[Math.floor(Math.random() * upper.length)];
    if (i === 1) return digits[Math.floor(Math.random() * digits.length)];
    if (i === 2) return special[Math.floor(Math.random() * special.length)];
    return all[Math.floor(Math.random() * all.length)];
  });
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function StatusBadge({ status }) {
  const meta = {
    active:    { label: "Active",    bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-600/20", dot: "bg-emerald-500" },
    suspended: { label: "Suspended", bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-600/20",     dot: "bg-red-500" },
    archived:  { label: "Archived",  bg: "bg-gray-100",   text: "text-gray-600",    ring: "ring-gray-500/20",    dot: "bg-gray-400" },
  }[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-500/20", dot: "bg-gray-400" };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.bg} ${meta.text} ${meta.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function UserStatusBadge({ active }) {
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
    label: "Email Sending",
    desc: "Allow sending invoices and overdue payment reminders by email (paid add-on — off by default)",
  },
];

function KpiCard({ icon, iconBg, label, value }) {
  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <div className="text-sm font-semibold text-gray-800 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

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

function ModalShell({ icon, iconColor, title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {icon && <span className={iconColor}>{icon}</span>}
            <span className="font-semibold text-gray-800 text-sm">{title}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={17} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
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
      setError(parseApiError(err, "Failed to reset password."));
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
    <ModalShell icon={<KeyRound size={15} />} iconColor="text-amber-500" title="Reset password" onClose={onClose}>
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
            <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
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
          <button onClick={onClose} className="w-full rounded-lg bg-gray-900 hover:bg-gray-700 py-2.5 text-sm font-semibold text-white">
            Done
          </button>
        </>
      )}
    </ModalShell>
  );
}

function EditNameModal({ currentName, onClose, onSave }) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) return onClose();
    setLoading(true);
    setError("");
    try {
      await onSave(name.trim());
      onClose();
    } catch (err) {
      setError(parseApiError(err, "Failed to update company name."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell icon={<Pencil size={14} />} iconColor="text-blue-500" title="Edit company name" onClose={onClose}>
      <form onSubmit={submit}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 mb-4"
          placeholder="Company name"
        />
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{error}</div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AddUserModal({ onClose, onAdd }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [showPw, setShowPw] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const copy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onAdd(identifier.trim(), password);
      onClose();
    } catch (err) {
      setError(parseApiError(err, "Failed to add user."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell icon={<UserPlus size={15} />} iconColor="text-emerald-500" title="Add user" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="block text-xs font-medium text-gray-500 mb-1">Username or email</label>
        <input
          autoFocus
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 mb-4"
          placeholder="jane@company.com"
        />
        <label className="block text-xs font-medium text-gray-500 mb-1">Temporary password</label>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-3 pr-9 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>
          <button type="button" onClick={() => setPassword(generatePassword())} title="Regenerate"
            className="h-[42px] w-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-50 shrink-0">
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={copy} title="Copy"
            className={`h-[42px] w-10 rounded-lg border flex items-center justify-center shrink-0 transition
              ${copied ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">User will be required to change this password on first login.</p>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{error}</div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <><UserPlus size={13} /> Add user</>}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ArchiveConfirmModal({ companyName, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(parseApiError(err, "Failed to archive tenant."));
      setLoading(false);
    }
  };

  return (
    <ModalShell icon={<Archive size={15} />} iconColor="text-red-500" title="Archive tenant" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-1">
        Archive <b>{companyName}</b>?
      </p>
      <p className="text-xs text-gray-400 mb-5">
        Their users won't be able to log in and this tenant will be hidden from the main list.
        Their data and database are kept — this can be undone any time from the archived list.
      </p>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={loading}
          className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 py-2 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <><Archive size={13} /> Archive</>}
        </button>
      </div>
    </ModalShell>
  );
}

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { viewingTenant, setViewingTenant } = useAuth();
  const [tenant,      setTenant]      = useState(null);
  const [features,    setFeatures]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [toggling,    setToggling]    = useState(false);
  const [savingFeat,  setSavingFeat]  = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [tab,         setTab]         = useState("users");
  const [editingName, setEditingName] = useState(false);
  const [addingUser,  setAddingUser]  = useState(false);
  const [archiving,   setArchiving]   = useState(false);

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

  const restoreTenant = async () => {
    if (!tenant) return;
    setToggling(true);
    try {
      setTenant(await updateTenantStatus(tenant.id, "active"));
    } catch {
      setError("Failed to restore tenant.");
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

  const handleSaveName = async (newName) => {
    const updated = await updateTenantName(tenant.id, newName);
    setTenant(updated);
  };

  const handleAddUser = async (identifier, password) => {
    const updated = await addTenantUser(tenant.id, identifier, password);
    setTenant(updated);
  };

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center animate-pulse">Loading…</div>;

  if (error || !tenant) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm max-w-lg mx-auto mt-10">
        <AlertCircle size={15} /> {error || "Tenant not found."}
      </div>
    );
  }

  const isActive = tenant.status === "active";
  const isArchived = tenant.status === "archived";
  const TABS = [
    { key: "users",    label: "Users",    icon: User },
    { key: "features", label: "Features", icon: Zap },
  ];

  return (
    <>
      {resetTarget && (
        <ResetModal user={resetTarget} onClose={() => setResetTarget(null)} onDone={handleResetDone} />
      )}
      {editingName && (
        <EditNameModal currentName={tenant.company_name} onClose={() => setEditingName(false)} onSave={handleSaveName} />
      )}
      {addingUser && (
        <AddUserModal onClose={() => setAddingUser(false)} onAdd={handleAddUser} />
      )}
      {archiving && (
        <ArchiveConfirmModal
          companyName={tenant.company_name}
          onClose={() => setArchiving(false)}
          onConfirm={async () => setTenant(await updateTenantStatus(tenant.id, "archived"))}
        />
      )}

      <div className="space-y-6">
        <Link to="/admin/tenants" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft size={15} /> All tenants
        </Link>

        {/* Header banner */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-sm">
              {initials(tenant.company_name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-900 truncate">{tenant.company_name}</h1>
                <button onClick={() => setEditingName(true)} className="text-gray-300 hover:text-blue-600 transition shrink-0" title="Edit name">
                  <Pencil size={15} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-xs text-gray-400 font-mono">{tenant.db_name}</p>
                <StatusBadge status={tenant.status} />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setViewingTenant({ id: tenant.id, company_name: tenant.company_name, db_name: tenant.db_name });
              navigate("/dashboard");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition border shrink-0
              ${viewingTenant?.id === tenant.id
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"}`}
          >
            <Eye size={14} /> {viewingTenant?.id === tenant.id ? "Viewing" : "View as"}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard icon={<Building2 size={18} className="text-blue-600" />} iconBg="bg-blue-50" label="Status" value={<StatusBadge status={tenant.status} />} />
          <KpiCard icon={<UsersIcon size={18} className="text-violet-600" />} iconBg="bg-violet-50" label="Users" value={tenant.users.length} />
          <KpiCard icon={<Calendar size={18} className="text-emerald-600" />} iconBg="bg-emerald-50" label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
          <KpiCard icon={<Clock size={18} className="text-amber-600" />} iconBg="bg-amber-50" label="Updated" value={tenant.updated_at ? new Date(tenant.updated_at).toLocaleDateString() : "—"} />
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: tabs + content */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
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
              {tab === "users" && (
                <button
                  onClick={() => setAddingUser(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition"
                >
                  <UserPlus size={14} /> Add user
                </button>
              )}
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
                        {["User", "Email", "Role", "Status", "Password", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {tenant.users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                                {initials(u.username)}
                              </div>
                              <span className="font-medium text-gray-800">{u.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                          <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                          <td className="px-4 py-3"><UserStatusBadge active={u.is_active} /></td>
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

          {/* Right: sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-800 mb-3">Tenant info</p>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-400">Company ID</dt>
                  <dd className="font-mono text-gray-700">#{tenant.id}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-400">Database</dt>
                  <dd className="font-mono text-xs text-gray-700 truncate max-w-[140px]" title={tenant.db_name}>{tenant.db_name}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-400">Primary contact</dt>
                  <dd className="text-gray-700 truncate max-w-[160px]" title={tenant.users[0]?.email}>{tenant.users[0]?.email || "—"}</dd>
                </div>
              </dl>
            </div>

            <div className={`rounded-xl border p-5 ${isArchived ? "bg-emerald-50/40 border-emerald-200" : "bg-red-50/40 border-red-200"}`}>
              <p className={`text-sm font-semibold mb-1 ${isArchived ? "text-emerald-800" : "text-red-800"}`}>
                {isArchived ? "Archived" : "Danger Zone"}
              </p>
              <p className={`text-xs mb-4 ${isArchived ? "text-emerald-700/80" : "text-red-700/80"}`}>
                {isArchived
                  ? "This tenant is archived — their users can't log in and the database is kept, untouched."
                  : "Suspending blocks login temporarily. Archiving hides this tenant and blocks login until restored."}
              </p>

              {isArchived ? (
                <button
                  onClick={restoreTenant}
                  disabled={toggling}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {toggling ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                  Restore tenant
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={toggleStatus}
                    disabled={toggling}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition border disabled:opacity-50
                      ${isActive
                        ? "bg-white text-red-600 hover:bg-red-100 border-red-200"
                        : "bg-white text-emerald-600 hover:bg-emerald-100 border-emerald-200"}`}
                  >
                    {toggling ? <Loader2 size={14} className="animate-spin" /> : isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    {isActive ? "Suspend tenant" : "Activate tenant"}
                  </button>
                  <button
                    onClick={() => setArchiving(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Archive size={14} /> Archive tenant
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
