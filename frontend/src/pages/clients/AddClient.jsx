// src/pages/AddClient.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../../api/clients";
import DialogBox from "../../components/DialogBox";

const STATUS_OPTIONS = ["Active", "Deactivated", "Blacklisted"];

// ✅ Local YYYY-MM-DD (avoids UTC off-by-one)
const todayStr = (() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

export default function AddClient() {
  const navigate = useNavigate();

  // ✅ match backend schema keys
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    joined_date: todayStr, // ✅ auto-selected to today

    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",

    default_currency: "",
    default_tax_rate: "",
    payment_terms: "",
    discount_rate: "",
    status: "Active",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("success");
  const [dialogMessage, setDialogMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = name === "phone" ? value.replace(/[^\d()+\-\s]/g, "") : value;
    setFormData((s) => ({ ...s, [name]: v }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = "Name is required.";
    if (!formData.email.trim()) e.email = "Email is required.";
    if (!formData.phone.trim()) e.phone = "Phone is required.";
    if (!formData.company.trim()) e.company = "Company is required.";

    if (!formData.address_line1.trim()) e.address_line1 = "Address Line 1 is required.";
    if (!formData.city.trim()) e.city = "City is required.";
    if (!formData.state.trim()) e.state = "State is required.";
    if (!formData.postal_code.trim()) e.postal_code = "Postal code is required.";

    if (formData.default_tax_rate !== "" && isNaN(Number(formData.default_tax_rate)))
      e.default_tax_rate = "Must be a number.";
    if (formData.discount_rate !== "" && isNaN(Number(formData.discount_rate)))
      e.discount_rate = "Must be a number.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // send exactly backend keys
      await createClient({
        ...formData,
        state: formData.state.toString(), // keep as-is; backend allows up to 100 chars
        joined_date: formData.joined_date || todayStr, // ✅ ensure a value goes through
        country: formData.country || null,
        default_currency: formData.default_currency || null,
        default_tax_rate:
          formData.default_tax_rate === "" ? null : Number(formData.default_tax_rate),
        discount_rate:
          formData.discount_rate === "" ? null : Number(formData.discount_rate),
        payment_terms: formData.payment_terms || null,
      });
      setDialogType("success");
      setDialogMessage("Client created successfully.");
      setShowDialog(true);
      setTimeout(() => navigate("/clients"), 700);
    } catch (err) {
      setDialogType("error");
      setDialogMessage("Failed to create client. Please check the fields.");
      setShowDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const err = (k) =>
    `w-full border px-3 py-2 rounded text-sm ${
      errors[k] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
      {showDialog && (
        <DialogBox
          message={dialogMessage}
          type={dialogType}
          onClose={() => setShowDialog(false)}
        />
      )}

      <h2 className="text-2xl font-bold mb-6">Add New Client</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name + Company */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={err("name")}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Company *</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className={err("company")}
            />
            {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
          </div>
        </div>

        {/* Email + Phone + Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={err("email")}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Phone *</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={err("phone")}
              placeholder="+1 555-123-4567"
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm bg-white border-gray-300"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Address Line 1 *</label>
          <input
            type="text"
            name="address_line1"
            value={formData.address_line1}
            onChange={handleChange}
            className={err("address_line1")}
            placeholder="Street address"
          />
          {errors.address_line1 && (
            <p className="text-red-500 text-xs mt-1">{errors.address_line1}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Address Line 2</label>
          <input
            type="text"
            name="address_line2"
            value={formData.address_line2}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded text-sm border-gray-300"
            placeholder="Apt, suite, etc."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">City *</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={err("city")}
            />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">State *</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className={err("state")}
              placeholder="MO"
              maxLength={100}
            />
            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Postal Code *</label>
            <input
              type="text"
              name="postal_code"
              value={formData.postal_code}
              onChange={handleChange}
              className={err("postal_code")}
              placeholder="63119"
            />
            {errors.postal_code && (
              <p className="text-red-500 text-xs mt-1">{errors.postal_code}</p>
            )}
          </div>
        </div>

        {/* Optional extras */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Country (2‑char)</label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm border-gray-300"
              placeholder="US"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Currency (3‑char)</label>
            <input
              type="text"
              name="default_currency"
              value={formData.default_currency}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm border-gray-300"
              placeholder="USD"
              maxLength={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Tax Rate %</label>
            <input
              type="text"
              name="default_tax_rate"
              value={formData.default_tax_rate}
              onChange={handleChange}
              className={err("default_tax_rate")}
              placeholder="e.g., 8.5"
            />
            {errors.default_tax_rate && (
              <p className="text-red-500 text-xs mt-1">{errors.default_tax_rate}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Payment Terms</label>
            <input
              type="text"
              name="payment_terms"
              value={formData.payment_terms}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm border-gray-300"
              placeholder="Net 30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Discount %</label>
            <input
              type="text"
              name="discount_rate"
              value={formData.discount_rate}
              onChange={handleChange}
              className={err("discount_rate")}
              placeholder="0"
            />
            {errors.discount_rate && (
              <p className="text-red-500 text-xs mt-1">{errors.discount_rate}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Joined Date</label>
            <input
              type="date"
              name="joined_date"
              value={formData.joined_date}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm border-gray-300"
              max={todayStr} // ✅ prevent selecting future dates by default
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded text-sm border-gray-300"
            placeholder="VIP client, billing preferences, etc."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate("/clients")}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 text-sm rounded text-white shadow ${
              loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Saving..." : "Save Client"}
          </button>
        </div>
      </form>
    </div>
  );
}
