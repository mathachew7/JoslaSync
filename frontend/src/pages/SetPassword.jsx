import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { setPassword } from "../api/admin";
import { useAuth } from "../context/AuthContext";

export default function SetPassword() {
  const [password, setPasswordVal] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await setPassword(password);
      await refreshUser();
      if (user?.role === "super_admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/setup", { replace: true });
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        "Failed to set password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-emerald-50" />
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-28 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/90 flex items-center justify-center shadow-sm">
              <KeyRound className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Set your password</h2>
              <p className="text-sm text-gray-500">You're using a temporary password. Create a new one to continue.</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPasswordVal(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-400 hover:text-emerald-600"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                className="w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${loading ? "opacity-80 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Setting password…
                </span>
              ) : (
                "Set password & continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
