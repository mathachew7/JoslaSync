// src/pages/Login.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Loader2, ShieldCheck, Lock, User } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const { ready, token, setToken } = useAuth();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (ready && token) navigate("/dashboard", { replace: true });
  }, [ready, token, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await login(username, password);
      const access = res?.access_token;
      if (!access) {
        setErrorMsg("Login failed: No token received.");
      } else {
        // store token -> AuthContext will fetch /auth/me
        setToken(access);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      const apiMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Invalid username or password.";
      setErrorMsg(apiMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-emerald-50" />

      {/* Decorative blurred blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-28 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Brand / Hero */}
          <div className="hidden md:flex flex-col justify-center p-8 rounded-3xl bg-white/50 backdrop-blur-xl border border-white/40 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/90 flex items-center justify-center shadow-sm">
                <ShieldCheck className="text-white" size={22} />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Joslasync</h1>
            </div>

            <p className="mt-6 text-gray-600">
              Welcome back. Sign in to manage invoices, clients, and reports with a clean,
              fast experience. Your data is protected with secure authentication.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Real-time dashboard and insights
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Smart invoicing and client tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Secure multi-tenant architecture
              </li>
            </ul>

            <div className="mt-8 flex items-center gap-3 text-xs text-gray-500">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>System status: All services operational</span>
            </div>
          </div>

          {/* Right: Form */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Log in</h2>
              <p className="text-gray-500 text-sm mt-1">Access your Joslasync workspace</p>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                <div className="shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/><path d="M12 2 1 21h22L12 2z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="mt-1 relative">
                  <input
                    id="username"
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="e.g. admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 peer-focus:text-emerald-500" size={18} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-400 hover:text-emerald-600 focus:outline-none"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <label className="inline-flex items-center gap-2 text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    Remember me
                  </label>
                  <Link to="/forgot-password" className="text-emerald-700 hover:underline">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full overflow-hidden rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${
                  loading ? "opacity-90 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Logging in…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Lock size={18} className="opacity-90" />
                    Continue
                  </span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Secondary actions */}
            <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="text-xs text-gray-600">
                Don’t have an account?{" "}
                <span className="font-medium text-gray-800">
                  Contact{" "}
                  <a href="mailto:support@joslatech.com" className="text-emerald-700 hover:underline">
                    support@joslatech.com
                  </a>
                </span>
                . Registration is private.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer tiny */}
      <div className="absolute bottom-3 left-0 right-0 z-10 text-center text-[11px] text-gray-400">
        © {new Date().getFullYear()} Joslasync • All Rights Reserved
      </div>
    </div>
  );
}
