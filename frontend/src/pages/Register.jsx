import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, User, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import API from "../lib/axios";

export default function Register() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await API.post("/api/auth/register", {
        company_name: companyName,
        username,
        email,
        password,
      });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Registration failed. Please try again."
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
        <div className="w-full max-w-md p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Create your workspace</h2>
            <p className="text-gray-500 text-sm mt-1">Set up your company on Joslasync</p>
          </div>

          {errorMsg && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <span className="text-sm font-medium">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Company Name" icon={<Building2 size={18} />}>
              <input
                type="text"
                required
                placeholder="Acme Inc."
                className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </Field>

            <Field label="Username" icon={<User size={18} />}>
              <input
                type="text"
                required
                placeholder="johndoe"
                className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>

            <Field label="Email" icon={<Mail size={18} />}>
              <input
                type="email"
                required
                placeholder="john@company.com"
                className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Password" icon={
              <button type="button" onClick={() => setShowPw((s) => !s)} className="text-gray-400 hover:text-emerald-600">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }>
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                className="peer w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-10 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${
                loading ? "opacity-90 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Creating workspace…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock size={18} /> Create Workspace
                </span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-emerald-700 font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      <div className="absolute bottom-3 left-0 right-0 z-10 text-center text-[11px] text-gray-400">
        © {new Date().getFullYear()} Joslasync • All Rights Reserved
      </div>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {children}
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{icon}</span>
      </div>
    </div>
  );
}
