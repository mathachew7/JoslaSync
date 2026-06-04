import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Edit2, Save, X, Trash2, Mail, Phone,
  MapPin, Building2, Calendar, FileText, Loader2, Eye,
} from "lucide-react";
import { US_STATES, STATE_TAX_RATES } from "../../constants/usStates";
import { getClient, updateClient, deleteClient } from "../../api/clients";
import { listInvoices } from "../../api/invoices";
import DialogBox from "../../components/DialogBox";

const STATUS_OPTIONS = ["Active", "Deactivated", "Blacklisted"];

const STATUS_STYLE = {
  Active:      "bg-green-100 text-green-700 border-green-200",
  Deactivated: "bg-blue-100 text-blue-700 border-blue-200",
  Blacklisted: "bg-red-100 text-red-700 border-red-200",
};

const money = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  });

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

const initials = (name) =>
  (name || "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join("");

function Field({ label, value, name, type = "text", editing, onChange, placeholder, maxLength, error, required }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">
        {label}{required && editing && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {editing ? (
        <>
          <input
            type={type}
            name={name}
            value={value ?? ""}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none ${
              error ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-blue-400"
            }`}
          />
          {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-800">{value || <span className="text-gray-400 italic">—</span>}</p>
      )}
    </div>
  );
}

function SelectField({ label, name, value, options, editing, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {editing ? (
        <select
          name={name}
          value={value ?? ""}
          onChange={onChange}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <p className="text-sm text-gray-800">{value || <span className="text-gray-400 italic">—</span>}</p>
      )}
    </div>
  );
}

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invMeta, setInvMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });

  const showToast = (type, msg) => {
    setToast({ show: true, type, msg });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, inv] = await Promise.all([
          getClient(clientId),
          listInvoices({ client_id: clientId, page: 1, page_size: 5, sort: "invoice_date", order: "desc" }),
        ]);
        if (!alive) return;
        setClient(c);
        setForm({
          name:             c.name ?? "",
          company:          c.company ?? "",
          email:            c.email ?? "",
          phone:            c.phone ?? "",
          status:           c.status ?? "Active",
          address_line1:    c.address_line1 ?? "",
          address_line2:    c.address_line2 ?? "",
          city:             c.city ?? "",
          state:            c.state ?? "",
          postal_code:      c.postal_code ?? "",
          country:          c.country ?? "",
          default_currency: c.default_currency ?? "",
          default_tax_rate: c.default_tax_rate ?? "",
          payment_terms:    c.payment_terms ?? "",
          discount_rate:    c.discount_rate ?? "",
          notes:            c.notes ?? "",
        });
        setInvoices(inv?.data ?? []);
        setInvMeta(inv?.meta ?? { total: 0 });
      } catch {
        showToast("error", "Failed to load client.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === "state" && STATE_TAX_RATES[value] !== undefined && !f.default_tax_rate) {
        next.default_tax_rate = STATE_TAX_RATES[value];
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim())  e.name  = "Name is required.";
    if (!form.phone?.trim()) e.phone = "Phone is required.";
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Enter a valid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Coerce empty strings to null for optional constrained fields
      const nullIfEmpty = (v) => (v === "" || v == null ? null : v);
      const updated = await updateClient(clientId, {
        ...form,
        country:          nullIfEmpty(form.country),
        default_currency: nullIfEmpty(form.default_currency),
        default_tax_rate: nullIfEmpty(form.default_tax_rate) === null ? null : Number(form.default_tax_rate),
        discount_rate:    nullIfEmpty(form.discount_rate)    === null ? null : Number(form.discount_rate),
        payment_terms:    nullIfEmpty(form.payment_terms),
        address_line2:    nullIfEmpty(form.address_line2),
        notes:            nullIfEmpty(form.notes),
      });
      setClient(updated);
      setEditing(false);
      showToast("success", "Client updated.");
    } catch {
      showToast("error", "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setForm({
      name:             client.name ?? "",
      company:          client.company ?? "",
      email:            client.email ?? "",
      phone:            client.phone ?? "",
      status:           client.status ?? "Active",
      address_line1:    client.address_line1 ?? "",
      address_line2:    client.address_line2 ?? "",
      city:             client.city ?? "",
      state:            client.state ?? "",
      postal_code:      client.postal_code ?? "",
      country:          client.country ?? "",
      default_currency: client.default_currency ?? "",
      default_tax_rate: client.default_tax_rate ?? "",
      payment_terms:    client.payment_terms ?? "",
      discount_rate:    client.discount_rate ?? "",
      notes:            client.notes ?? "",
    });
    setEditing(false);
    setErrors({});
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteClient(clientId);
      navigate("/clients");
    } catch {
      showToast("error", "Delete failed.");
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  // Derived invoice stats
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const paidInvoices  = invoices.filter((i) => i.status === "INVOICE").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading client…
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20 text-gray-500">
        Client not found.{" "}
        <button onClick={() => navigate("/clients")} className="text-blue-600 underline">Back</button>
      </div>
    );
  }

  const displayName = form.name || client.name || "Unnamed";

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {toast.show && (
        <DialogBox
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
        />
      )}

      {/* Delete confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-800">Delete client?</h3>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium">{displayName}</span> will be permanently removed. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50" disabled={deleting}>
                Cancel
              </button>
              <button onClick={onDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/clients")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={16} /> Clients
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={onCancel} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
                <X size={15} /> Cancel
              </button>
              <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                <Save size={15} /> {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
                <Edit2 size={15} /> Edit
              </button>
              <button onClick={() => setShowConfirm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
                <Trash2 size={15} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-white shadow rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initials(displayName)}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Full name *"
                  className={`border rounded px-3 py-1.5 text-lg font-semibold w-full sm:w-56 focus:outline-none ${errors.name ? "border-red-400" : "border-gray-300 focus:border-blue-400"}`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
              </div>
              <input
                name="company"
                value={form.company}
                onChange={onChange}
                placeholder="Company"
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-48 focus:outline-none focus:border-blue-400"
              />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 truncate">{displayName}</h2>
              {client.company && <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5"><Building2 size={13} /> {client.company}</p>}
            </>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {/* Status badge / selector */}
            {editing ? (
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none"
              >
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded-full ${STATUS_STYLE[client.status] ?? "bg-gray-100 text-gray-700"}`}>
                {client.status}
              </span>
            )}
            {client.joined_date && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar size={12} /> Since {fmt(client.joined_date)}
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={12} /> Added {fmt(client.created_at)}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 text-center shrink-0">
          <div>
            <p className="text-lg font-bold text-gray-800">{invMeta.total}</p>
            <p className="text-xs text-gray-400">Invoices</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{money(totalInvoiced)}</p>
            <p className="text-xs text-gray-400">Invoiced</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">{paidInvoices}</p>
            <p className="text-xs text-gray-400">Paid</p>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Contact info */}
        <div className="bg-white shadow rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <Mail size={14} /> Contact
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" name="email" type="email" value={form.email} editing={editing} onChange={onChange} placeholder="email@company.com" error={errors.email} />
            <Field label="Phone" name="phone" value={form.phone} editing={editing} onChange={onChange} placeholder="+1 555-000-0000" error={errors.phone} required />
          </div>
        </div>

        {/* Financial defaults */}
        <div className="bg-white shadow rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <FileText size={14} /> Financial Defaults
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default Tax Rate (%)" name="default_tax_rate" type="number" value={form.default_tax_rate} editing={editing} onChange={onChange} placeholder="8.5" />
            <Field label="Currency" name="default_currency" value={form.default_currency} editing={editing} onChange={onChange} placeholder="USD" maxLength={3} />
            <Field label="Payment Terms" name="payment_terms" value={form.payment_terms} editing={editing} onChange={onChange} placeholder="Net 30" />
            <Field label="Discount (%)" name="discount_rate" type="number" value={form.discount_rate} editing={editing} onChange={onChange} placeholder="0" />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white shadow rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <MapPin size={14} /> Address
          </h3>
          <Field label="Line 1" name="address_line1" value={form.address_line1} editing={editing} onChange={onChange} placeholder="Street address" />
          <Field label="Line 2" name="address_line2" value={form.address_line2} editing={editing} onChange={onChange} placeholder="Suite, apt…" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Field label="City" name="city" value={form.city} editing={editing} onChange={onChange} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">State</p>
              {editing ? (
                <select name="state" value={form.state ?? ""} onChange={onChange} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                  <option value="">— Select —</option>
                  {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                </select>
              ) : (
                <p className="text-sm text-gray-800">{form.state || <span className="text-gray-400 italic">—</span>}</p>
              )}
            </div>
            <Field label="Postal Code" name="postal_code" value={form.postal_code} editing={editing} onChange={onChange} />
          </div>
          <Field label="Country (2-char)" name="country" value={form.country} editing={editing} onChange={onChange} placeholder="US" maxLength={2} />
        </div>

        {/* Notes */}
        <div className="bg-white shadow rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Notes</h3>
          {editing ? (
            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              rows={6}
              placeholder="VIP client, billing preferences, special terms…"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {client.notes || <span className="text-gray-400 italic">No notes.</span>}
            </p>
          )}
        </div>
      </div>

      {/* Invoice history */}
      <div className="bg-white shadow rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <FileText size={14} /> Invoice History
            <span className="ml-1 text-xs font-normal text-gray-400">({invMeta.total} total)</span>
          </h3>
          <button
            onClick={() => navigate(`/invoices/create`)}
            className="text-xs text-blue-600 border border-blue-200 rounded px-2.5 py-1 hover:bg-blue-50"
          >
            + New Invoice
          </button>
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No invoices yet for this client.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="py-2 px-3 text-left">Invoice #</th>
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Due</th>
                  <th className="py-2 px-3 text-left">Status</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-gray-50 transition">
                    <td className="py-2 px-3 font-medium text-gray-800">{inv.invoice_no}</td>
                    <td className="py-2 px-3 text-gray-500">{fmt(inv.invoice_date)}</td>
                    <td className="py-2 px-3 text-gray-500">{inv.due_date ? fmt(inv.due_date) : "—"}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-xs rounded border ${
                        inv.status === "INVOICE" ? "bg-green-50 text-green-700 border-green-200" :
                        inv.status === "VOID"    ? "bg-red-50 text-red-700 border-red-200" :
                                                   "bg-gray-50 text-gray-600 border-gray-200"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums">{money(inv.total)}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invMeta.total > 5 && (
          <div className="mt-3 text-center">
            <button
              onClick={() => navigate(`/invoices?client_id=${clientId}`)}
              className="text-xs text-blue-600 hover:underline"
            >
              View all {invMeta.total} invoices →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
