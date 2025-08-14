// src/pages/EditClient.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getClient, updateClient, deleteClient } from "../../api/clients";
import DialogBox from "../../components/DialogBox";
import { ArrowLeft, Loader2 } from "lucide-react";

const STATUS_OPTIONS = ["Active", "Deactivated", "Blacklisted"];
const isPhone = (v) => /^\+?[0-9()\-\s]{7,20}$/.test((v || "").trim());
const isState = (v) => /^[A-Za-z]{2}$/.test((v || "").trim());
const isZip = (v) => /^\d{5}(-\d{4})?$/.test((v || "").trim());
const getInitials = (name) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("") || "?";

export default function EditClient() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 🔔 toast dialog (for success/error)
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("success");
  const [dialogMessage, setDialogMessage] = useState("");

  // 🧾 confirm modal state (inline, not browser confirm)
  const [showConfirm, setShowConfirm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "Active",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip_code: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  // Load client → map backend keys -> form keys
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await getClient(clientId);
        if (!mounted) return;
        setFormData({
          name: d.name || "",
          company: d.company || "",
          email: d.email || "",
          phone: d.phone || "",
          status: d.status || "Active",
          // 🔁 key mapping from backend → form
          address1: d.address1 ?? d.address_line1 ?? "",
          address2: d.address2 ?? d.address_line2 ?? "",
          city: d.city ?? "",
          state: (d.state ?? "").toString(),
          zip_code: d.zip_code ?? d.postal_code ?? "",
          notes: d.notes ?? "",
        });
      } catch {
        setDialogType("error");
        setDialogMessage("Failed to load client.");
        setShowDialog(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  const fullName = useMemo(() => formData.name?.trim() || "Unnamed Client", [formData.name]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = name === "phone" ? value.replace(/[^\d+()\-\s]/g, "") : value;
    setFormData((s) => ({ ...s, [name]: v }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required.";
    if (!formData.company.trim()) newErrors.company = "Company is required.";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required.";
    else if (!isPhone(formData.phone)) newErrors.phone = "Enter a valid phone number.";
    if (!formData.address1.trim()) newErrors.address1 = "Address Line 1 is required.";
    if (!formData.city.trim()) newErrors.city = "City is required.";
    if (!formData.state.trim()) newErrors.state = "State is required.";
    else if (!isState(formData.state)) newErrors.state = "Use 2-letter code (e.g., MO).";
    if (!formData.zip_code.trim()) newErrors.zip_code = "ZIP Code is required.";
    else if (!isZip(formData.zip_code)) newErrors.zip_code = "ZIP must be 12345 or 12345-6789.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // 🔁 key mapping from form → backend (accepts both just in case)
      const payload = {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        address1: formData.address1,
        address2: formData.address2,
        address_line1: formData.address1,
        address_line2: formData.address2,
        city: formData.city,
        state: formData.state.toUpperCase(),
        zip_code: formData.zip_code,
        postal_code: formData.zip_code,
        notes: formData.notes,
      };
      await updateClient(clientId, payload);
      setDialogType("success");
      setDialogMessage("Client updated successfully.");
      setShowDialog(true);
    } catch {
      setDialogType("error");
      setDialogMessage("Update failed. Please review the fields.");
      setShowDialog(true);
    } finally {
      setSaving(false);
    }
  };

  // 🔁 open custom confirm modal instead of browser confirm()
  const onDelete = () => {
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteClient(clientId);
      setDialogType("success");
      setDialogMessage("Client deleted.");
      setShowDialog(true);
      setShowConfirm(false);
      // small delay so the toast is visible before navigation
      setTimeout(() => navigate("/clients"), 400);
    } catch {
      setDialogType("error");
      setDialogMessage("Delete failed. Try again.");
      setShowDialog(true);
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="animate-spin mr-2" /> Loading client…
      </div>
    );
    }

  const errClass = (name) =>
    `w-full border px-3 py-2 rounded text-sm ${
      errors[name] ? "border-red-500" : "border-gray-300"
    } focus:outline-none`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showDialog && (
        <DialogBox
          message={dialogMessage}
          type={dialogType}
          onClose={() => setShowDialog(false)}
        />
      )}

      {/* Inline confirm dialog (modal) */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl bg-white shadow-lg border p-5">
            <h3 className="text-lg font-semibold">Delete client?</h3>
            <p className="text-sm text-gray-600 mt-1">
              This action cannot be undone. The client and related references may be removed.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-100"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={`px-4 py-2 text-sm rounded text-white ${
                  deleting ? "bg-red-300" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back only (no page title; layout handles it) */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div />
      </div>

      {/* Profile section centered at top */}
      <div className="flex flex-col items-center justify-center mt-2 mb-2">
        <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-700">
          {getInitials(fullName)}
        </div>
        <div className="mt-2 text-center">
          <p className="font-semibold">{fullName}</p>
          <p className="text-gray-500 text-sm">Client Profile</p>
        </div>
      </div>

      {/* Form card */}
      <form onSubmit={onUpdate} className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className={errClass("name")} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Company *</label>
            <input type="text" name="company" value={formData.company} onChange={handleChange} className={errClass("company")} />
            {errors.company && <p className="text-xs text-red-600 mt-1">{errors.company}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded text-sm border-gray-300"
              placeholder="optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Phone *</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={errClass("phone")}
              placeholder="+1 555-123-4567"
            />
            {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
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
          <input type="text" name="address1" value={formData.address1} onChange={handleChange} className={errClass("address1")} />
          {errors.address1 && <p className="text-xs text-red-600 mt-1">{errors.address1}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Address Line 2</label>
          <input
            type="text"
            name="address2"
            value={formData.address2}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded text-sm border-gray-300"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">City *</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} className={errClass("city")} />
            {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">State *</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className={errClass("state")}
              placeholder="MO"
              maxLength={2}
            />
            {errors.state && <p className="text-xs text-red-600 mt-1">{errors.state}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ZIP Code *</label>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              className={errClass("zip_code")}
              placeholder="63119"
            />
            {errors.zip_code && <p className="text-xs text-red-600 mt-1">{errors.zip_code}</p>}
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

        {/* Bottom actions inside page */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className={`px-4 py-2 text-sm rounded border ${
              deleting ? "bg-red-200 text-red-700" : "text-red-600 border-red-300 hover:bg-red-50"
            }`}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>

          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 text-sm rounded text-white shadow ${
              saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saving ? "Updating..." : "Update"}
          </button>
        </div>
      </form>
    </div>
  );
}
