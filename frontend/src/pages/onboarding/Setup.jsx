import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Camera, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getCompanyProfile, updateCompanyProfile } from "../../api/company";
import { parseApiError } from "../../utils/parseApiError";

const STATE_TAX = {
  NY: 8.875, CA: 7.25, TX: 6.25, FL: 6.0, IL: 6.25,
  MO: 4.225, NJ: 6.625, GA: 4.0, OH: 5.75, WA: 6.5,
};

export default function Setup() {
  const { user, company: authCompany } = useAuth();
  const navigate = useNavigate();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    company_name:   "",
    company_email:  "",
    company_mobile: "",
    full_name:      "",
    address1:       "",
    address2:       "",
    city:           "",
    state:          "",
    zip_code:       "",
    tax_rate:       "",
  });
  const [logoFile, setLogoFile]       = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Seed defaults from auth context (master DB company name + user email)
    const seed = {
      company_name:  authCompany?.company_name || "",
      company_email: user.email || "",
    };

    // Try to load existing tenant profile (may already have more data)
    getCompanyProfile()
      .then((p) => {
        setForm({
          company_name:   p.company_name   || seed.company_name,
          company_email:  p.company_email  || seed.company_email,
          company_mobile: p.company_mobile || "",
          full_name:      p.full_name      || "",
          address1:       p.address1       || "",
          address2:       p.address2       || "",
          city:           p.city           || "",
          state:          p.state          || "",
          zip_code:       p.zip_code       || "",
          tax_rate:       p.tax_rate != null ? String(p.tax_rate) : "",
        });
        if (p.logo_url) setLogoPreview(p.logo_url);
      })
      .catch(() => {
        // No tenant profile yet — use seed defaults
        setForm((prev) => ({ ...prev, ...seed }));
      })
      .finally(() => setBooting(false));
  }, [user, authCompany]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleStateChange = (val) => {
    setForm((p) => ({
      ...p,
      state:    val,
      tax_rate: val && STATE_TAX[val] != null ? String(STATE_TAX[val]) : p.tax_rate,
    }));
  };

  const handleLogoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const fd = new FormData();
      if (logoFile) fd.append("logoFile", logoFile);
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) fd.append(k, String(v));
      });
      await updateCompanyProfile(fd);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(parseApiError(err, "Failed to save. Please try again."));
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <div className="grid place-items-center h-screen bg-gray-50">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-28 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand */}
        <div className="text-center mb-8">
          <span className="text-2xl font-extrabold tracking-tight text-gray-900">Joslasync</span>
          <p className="text-sm text-gray-500 mt-1">Set up your company profile</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Building2 className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Company Setup</h2>
              <p className="text-sm text-gray-500">This appears on all your invoices.</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-2">
              <div
                onClick={() => fileRef.current?.click()}
                className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 transition flex items-center justify-center overflow-hidden bg-gray-50 shrink-0"
              >
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="h-full w-full object-cover" />
                  : <Camera size={20} className="text-gray-400" />}
              </div>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-sm text-blue-600 hover:underline font-medium">
                  {logoPreview ? "Change logo" : "Upload logo"}
                </button>
                <p className="text-xs text-gray-400 mt-0.5">JPG or PNG</p>
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="hidden" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Company Name" span>
                <input required value={form.company_name} onChange={set("company_name")}
                  className={inp} placeholder="Acme Corp" />
              </Field>

              <Field label="Your Full Name" span>
                <input required value={form.full_name} onChange={set("full_name")}
                  className={inp} placeholder="Jane Smith" />
              </Field>

              <Field label="Company Email">
                <input type="email" required value={form.company_email} onChange={set("company_email")}
                  className={inp} placeholder="billing@acme.com" />
              </Field>

              <Field label="Phone (10 digits)">
                <input required value={form.company_mobile} onChange={set("company_mobile")}
                  className={inp} placeholder="9876543210" maxLength={10} />
              </Field>

              <Field label="Address Line 1" span>
                <input value={form.address1} onChange={set("address1")}
                  className={inp} placeholder="123 Main St" />
              </Field>

              <Field label="Address Line 2" span>
                <input value={form.address2} onChange={set("address2")}
                  className={inp} placeholder="Suite 100 (optional)" />
              </Field>

              <Field label="City">
                <input value={form.city} onChange={set("city")} className={inp} placeholder="New York" />
              </Field>

              <Field label="Zip Code">
                <input value={form.zip_code} maxLength={5} onChange={set("zip_code")}
                  className={inp} placeholder="10001" />
              </Field>

              <Field label="State">
                <select value={form.state} onChange={(e) => handleStateChange(e.target.value)} className={inp}>
                  <option value="">Select state</option>
                  {Object.keys(STATE_TAX).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Tax Rate (%)">
                <input type="number" step="0.01" value={form.tax_rate} onChange={set("tax_rate")}
                  className={inp} placeholder="Auto from state" />
              </Field>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 mt-2 transition disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? "Saving…" : "Complete Setup"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          You can update these any time from <strong>Company</strong> in the sidebar.
        </p>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white";

function Field({ label, children, span = false }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
