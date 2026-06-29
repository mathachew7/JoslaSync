import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";
import API from "../lib/axios";

export default function ResetPassword() {
  const [token,    setToken]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      await API.post("/api/auth/reset-password", { token: token.trim(), new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err?.response?.data?.detail || "Reset failed. The token may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {!done ? (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">Reset password</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Enter the token from your email and choose a new password.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reset token</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      required
                      placeholder="Paste token from email"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  {loading ? "Resetting…" : "Set new password"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={22} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-sm text-gray-500">Redirecting to login…</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
