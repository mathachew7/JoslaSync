import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../../api/clients";
import { US_STATES, STATE_TAX_RATES } from "../../constants/usStates";
import DialogBox from "../../components/DialogBox";

const todayStr = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

const SECTION = "bg-white shadow rounded-xl p-5 space-y-4";
const LABEL   = "block text-xs font-medium text-gray-500 mb-1";

export default function AddClient() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name:             "",
    email:            "",
    phone:            "",
    company:          "",
    notes:            "",
    joined_date:      todayStr,
    address_line1:    "",
    address_line2:    "",
    city:             "",
    state:            "",
    postal_code:      "",
    country:          "US",
    default_currency: "USD",
    default_tax_rate: "",
    payment_terms:    "",
    discount_rate:    "",
  });

  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [dialog,  setDialog]  = useState({ show: false, type: "success", msg: "" });

  const set = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // Auto-fill state tax rate when US state changes
      if (name === "state" && STATE_TAX_RATES[value] !== undefined) {
        next.default_tax_rate = String(STATE_TAX_RATES[value]);
      }
      return next;
    });
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())          e.name          = "Required.";
    if (!form.email.trim())         e.email         = "Required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email.";
    if (!form.phone.trim())         e.phone         = "Required.";
    if (!form.address_line1.trim()) e.address_line1 = "Required.";
    if (!form.city.trim())          e.city          = "Required.";
    if (!form.state)                e.state         = "Required.";
    if (!form.postal_code.trim())   e.postal_code   = "Required.";
    if (form.default_tax_rate !== "" && isNaN(Number(form.default_tax_rate)))
      e.default_tax_rate = "Must be a number.";
    if (form.discount_rate !== "" && isNaN(Number(form.discount_rate)))
      e.discount_rate = "Must be a number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await createClient({
        ...form,
        company:          form.company   || null,
        address_line2:    form.address_line2 || null,
        country:          form.country   || null,
        default_currency: form.default_currency || null,
        default_tax_rate: form.default_tax_rate === "" ? null : Number(form.default_tax_rate),
        discount_rate:    form.discount_rate    === "" ? null : Number(form.discount_rate),
        payment_terms:    form.payment_terms    || null,
        notes:            form.notes            || null,
      });
      setDialog({ show: true, type: "success", msg: "Client created successfully." });
      setTimeout(() => navigate("/clients"), 700);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg).join(", ")
        : (typeof detail === "string" ? detail : "Failed to create client.");
      setDialog({ show: true, type: "error", msg });
    } finally {
      setLoading(false);
    }
  };

  const inp = (name) =>
    `w-full border rounded px-3 py-2 text-sm focus:outline-none ${
      errors[name] ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-blue-400"
    }`;

  const Err = ({ name }) =>
    errors[name] ? <p className="text-xs text-red-500 mt-0.5">{errors[name]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-5">
      {dialog.show && (
        <DialogBox message={dialog.msg} type={dialog.type} onClose={() => setDialog((d) => ({ ...d, show: false }))} />
      )}

      {/* ── Identity ── */}
      <div className={SECTION}>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Full Name <span className="text-red-500">*</span></label>
            <input type="text" name="name" value={form.name} onChange={set} className={inp("name")} placeholder="Jane Doe" />
            <Err name="name" />
          </div>
          <div>
            <label className={LABEL}>Company <span className="text-gray-400">(optional)</span></label>
            <input type="text" name="company" value={form.company} onChange={set} className={inp("company")} placeholder="Acme Inc" />
          </div>
          <div>
            <label className={LABEL}>Email <span className="text-red-500">*</span></label>
            <input type="email" name="email" value={form.email} onChange={set} className={inp("email")} placeholder="jane@acme.com" />
            <Err name="email" />
          </div>
          <div>
            <label className={LABEL}>Phone <span className="text-red-500">*</span></label>
            <input
              type="text" name="phone" value={form.phone}
              onChange={(e) => set({ target: { name: "phone", value: e.target.value.replace(/[^\d()+\-\s]/g, "") } })}
              className={inp("phone")} placeholder="+1 555-123-4567"
            />
            <Err name="phone" />
          </div>
        </div>
      </div>

      {/* ── Address ── */}
      <div className={SECTION}>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Address</h3>
        <div>
          <label className={LABEL}>Address Line 1 <span className="text-red-500">*</span></label>
          <input type="text" name="address_line1" value={form.address_line1} onChange={set} className={inp("address_line1")} placeholder="123 Main Street" />
          <Err name="address_line1" />
        </div>
        <div>
          <label className={LABEL}>Address Line 2 <span className="text-gray-400">(optional)</span></label>
          <input type="text" name="address_line2" value={form.address_line2} onChange={set} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" placeholder="Suite 200" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className={LABEL}>City <span className="text-red-500">*</span></label>
            <input type="text" name="city" value={form.city} onChange={set} className={inp("city")} />
            <Err name="city" />
          </div>
          <div>
            <label className={LABEL}>State <span className="text-red-500">*</span></label>
            <select name="state" value={form.state} onChange={set} className={`w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 ${errors.state ? "border-red-400" : "border-gray-300"}`}>
              <option value="">— Select —</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Postal Code <span className="text-red-500">*</span></label>
            <input type="text" name="postal_code" value={form.postal_code} onChange={set} className={inp("postal_code")} placeholder="63119" />
            <Err name="postal_code" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Country</label>
            <input type="text" name="country" value={form.country} onChange={set} maxLength={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 uppercase" placeholder="US" />
          </div>
        </div>
      </div>

      {/* ── Financial defaults ── */}
      <div className={SECTION}>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Financial Defaults <span className="text-gray-400 font-normal normal-case text-xs">(optional — used on invoices)</span></h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>Default Tax %</label>
            <input type="number" name="default_tax_rate" value={form.default_tax_rate} onChange={set} className={inp("default_tax_rate")} placeholder="8.5" min="0" max="100" step="any" />
            <Err name="default_tax_rate" />
          </div>
          <div>
            <label className={LABEL}>Currency</label>
            <input type="text" name="default_currency" value={form.default_currency} onChange={set} maxLength={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 uppercase" placeholder="USD" />
          </div>
          <div>
            <label className={LABEL}>Payment Terms</label>
            <input type="text" name="payment_terms" value={form.payment_terms} onChange={set} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" placeholder="Net 30" />
          </div>
          <div>
            <label className={LABEL}>Discount %</label>
            <input type="number" name="discount_rate" value={form.discount_rate} onChange={set} className={inp("discount_rate")} placeholder="0" min="0" max="100" step="0.01" />
            <Err name="discount_rate" />
          </div>
        </div>
      </div>

      {/* ── Other ── */}
      <div className={SECTION}>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Other</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Joined Date</label>
            <input type="date" name="joined_date" value={form.joined_date} onChange={set} max={todayStr} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>
        <div>
          <label className={LABEL}>Notes</label>
          <textarea name="notes" rows={3} value={form.notes} onChange={set} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" placeholder="VIP client, billing preferences…" />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => navigate("/clients")} className="px-4 py-2 text-sm border rounded hover:bg-gray-50" disabled={loading}>
          Cancel
        </button>
        <button type="submit" disabled={loading} className={`px-6 py-2 text-sm rounded text-white shadow ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
          {loading ? "Saving…" : "Save Client"}
        </button>
      </div>
    </form>
  );
}
