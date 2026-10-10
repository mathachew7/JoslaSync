// src/pages/Health.jsx
import { ShieldCheck, XCircle, Loader2, RefreshCw } from "lucide-react";
import { useHealthStatus } from "../hooks/useHealthStatus";

function formatUptime(seconds) {
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

export default function Health() {
  const { status, lastChecked, uptimeSeconds, version } = useHealthStatus();

  const isOk = status === "ok";
  const isChecking = status === "checking";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <div className="flex justify-center mb-4">
          {isChecking ? (
            <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
          ) : isOk ? (
            <ShieldCheck className="h-12 w-12 text-emerald-500" />
          ) : (
            <XCircle className="h-12 w-12 text-red-500" />
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-800">
          {isChecking ? "Checking status…" : isOk ? "All services operational" : "Service unreachable"}
        </h1>

        <div className="mt-6 space-y-2 text-sm text-gray-600 text-left bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between">
            <span>Status</span>
            <span className={`font-medium ${isOk ? "text-emerald-600" : isChecking ? "text-gray-500" : "text-red-600"}`}>
              {isChecking ? "Checking…" : isOk ? "Operational" : "Down"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Last checked</span>
            <span className="font-medium text-gray-800">
              {lastChecked ? lastChecked.toLocaleString() : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Backend uptime</span>
            <span className="font-medium text-gray-800">{formatUptime(uptimeSeconds)}</span>
          </div>
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-medium text-gray-800">{version ? `v${version}` : "—"}</span>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
    </div>
  );
}
