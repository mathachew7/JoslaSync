import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import API from "../lib/axios";

export default function ForgotPassword() {
  const [email,    setEmail]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [debugToken, setDebugToken] = useState("");
  const [error,    setError]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await API.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
      if (data.debug_token) setDebugToken(data.debug_token);
    } catch (err) {
      setError(err?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {!sent ? (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">Forgot password</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we'll send you a reset token.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  {loading ? "Sending…" : "Send reset token"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={22} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-4">
                If <b>{email}</b> is registered, a reset token has been sent.
              </p>

              {debugToken && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Dev mode — token:</p>
                  <code className="text-xs font-mono text-amber-800 break-all">{debugToken}</code>
                </div>
              )}

              <Link
                to="/reset-password"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
              >
                Enter reset token
              </Link>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center">
            <Link to="/login" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={13} /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
