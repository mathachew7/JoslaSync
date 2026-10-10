import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, Eye, EyeOff, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { createTenant } from "../../api/admin";
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
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export default function CreateTenant() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company_name: "",
    username_or_email: "",
    temp_password: generatePassword(),
  });
  const [showPw, setShowPw] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const regenerate = useCallback(() => {
    setForm(f => ({ ...f, temp_password: generatePassword() }));
    setCopied(false);
  }, []);

  const copyPassword = useCallback(() => {
    navigator.clipboard.writeText(form.temp_password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [form.temp_password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tenant = await createTenant(form);
      navigate(`/admin/tenants/${tenant.id}`, { replace: true });
    } catch (err) {
      setError(parseApiError(err, "Failed to create tenant."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/admin/tenants" className="text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">New tenant</h2>
          <p className="text-sm text-gray-400">Create an organization and their admin account</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Organization */}
          <div className="pb-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Building2 size={11} /> Organization
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
            <input
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              placeholder="e.g. Acme Corp"
              value={form.company_name}
              onChange={set("company_name")}
            />
          </div>

          {/* Admin account */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Admin account</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username or email</label>
                <input
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  placeholder="john_doe or john@acme.com"
                  value={form.username_or_email}
                  onChange={set("username_or_email")}
                />
                <p className="mt-1 text-xs text-gray-400">
                  If email is provided, it's used directly. Otherwise treated as username.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      required
                      type={showPw ? "text" : "password"}
                      minLength={6}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm font-mono outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      value={form.temp_password}
                      onChange={set("temp_password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Copy */}
                  <button
                    type="button"
                    onClick={copyPassword}
                    title="Copy password"
                    className={`flex items-center justify-center h-[46px] w-11 rounded-xl border transition shrink-0
                      ${copied
                        ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                        : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>

                  {/* Regenerate */}
                  <button
                    type="button"
                    onClick={regenerate}
                    title="Generate new password"
                    className="flex items-center justify-center h-[46px] w-11 rounded-xl border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 transition shrink-0"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  User will be prompted to change this on first login. Copy it before creating.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              to="/admin/tenants"
              className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition ${loading ? "opacity-80 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Creating…
                </span>
              ) : "Create tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
