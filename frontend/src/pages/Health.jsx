// src/pages/Health.jsx
import { Link } from "react-router-dom";
import { ShieldCheck, AlertTriangle, XCircle, Loader2, RefreshCw, ArrowLeft, Mail } from "lucide-react";
import { useHealthStatus } from "../hooks/useHealthStatus";
import { useAuth } from "../context/AuthContext";

function formatDuration(seconds) {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const BANNER = {
  checking: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", icon: Loader2, label: "Checking status…" },
  ok: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: ShieldCheck, label: "All systems operational" },
  degraded: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: AlertTriangle, label: "Partial outage" },
  down: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: XCircle, label: "Service unreachable" },
};

function ComponentRow({ name, status }) {
  const ok = status === "ok";
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-800">{name}</span>
      <span
        className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
          ok ? "text-emerald-600" : "text-red-600"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
        {ok ? "Operational" : "Down"}
      </span>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function Health() {
  const { status, components, lastChecked, serverTime, startedAt, uptimeSeconds, version, responseMs } =
    useHealthStatus();
  const { token } = useAuth();
  const banner = BANNER[status] || BANNER.checking;
  const Icon = banner.icon;
  const homePath = token ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/90 flex items-center justify-center shadow-sm">
              <ShieldCheck className="text-white" size={16} />
            </div>
            <span className="text-base font-bold text-gray-800">Joslasync</span>
            <span className="text-sm text-gray-400 font-medium">Status</span>
          </div>
          <Link to={homePath} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={15} />
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Hero banner */}
        <div className={`rounded-2xl border ${banner.bg} ${banner.border} px-8 py-10 flex flex-col items-center text-center gap-2`}>
          <Icon className={`h-10 w-10 ${banner.text} ${status === "checking" ? "animate-spin" : ""}`} />
          <h1 className={`text-2xl font-bold ${banner.text}`}>{banner.label}</h1>
          <p className="text-sm text-gray-500 font-mono">{formatDate(serverTime)}</p>
        </div>

        {/* Components */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">Components</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {components.length ? (
              components.map((c) => <ComponentRow key={c.name} name={c.name} status={c.status} />)
            ) : (
              <div className="px-6 py-4 text-sm text-gray-400">No data yet.</div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">Details</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <DetailRow label="Server time" value={formatDate(serverTime)} mono />
            <DetailRow label="Last deployed" value={formatDate(startedAt)} mono />
            <DetailRow label="Uptime since deploy" value={formatDuration(uptimeSeconds)} />
            <DetailRow label="Response time" value={responseMs != null ? `${responseMs} ms` : "—"} />
            <DetailRow label="Last checked" value={lastChecked ? lastChecked.toLocaleString() : "—"} />
            <DetailRow label="Version" value={version ? `v${version}` : "—"} />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} Joslasync · All Rights Reserved</span>
          <a href="mailto:ysubash@joslatech.com" className="flex items-center gap-1.5 hover:text-gray-700">
            <Mail size={13} />
            ysubash@joslatech.com
          </a>
        </div>
      </div>
    </div>
  );
}
