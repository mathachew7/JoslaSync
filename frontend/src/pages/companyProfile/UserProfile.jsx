// src/pages/companyProfile/UserProfile.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getCompanyProfile,
  updateCompanyProfile,
  getCompanySettings,
  updateReminderSettings,
  updateInvoiceSettings,
} from "../../api/company";
import DialogBox from "../../components/DialogBox";
import {
  Camera,
  Loader2,
  RefreshCw,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Building2,
  MapPin,
  Bell,
  FileText,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getDefaultTerms } from "../../utils/generateInvoicePdf";

const TABS = [
  { id: "company",   label: "Company",    icon: Building2 },
  { id: "address",   label: "Address & Tax", icon: MapPin },
  { id: "invoices",  label: "Invoices",   icon: Receipt },
  { id: "reminders", label: "Reminders",  icon: Bell },
  { id: "legal",     label: "Legal",      icon: FileText },
  { id: "security",  label: "Security",   icon: ShieldCheck },
];

export default function UserProfile() {
  const { user, ready } = useAuth();
  const isMaster =
    !!user &&
    (user?.role === "master" || user?.email === import.meta.env.VITE_MASTER_EMAIL);

  const [activeTab, setActiveTab] = useState("company");

  const [reminderSettings, setReminderSettings] = useState({
    reminder_enabled: false,
    reminder_frequency_days: 7,
    reminder_max_count: 3,
  });
  const [savingReminder, setSavingReminder] = useState(false);

  const [invoiceSettings, setInvoiceSettings] = useState({
    invoice_prefix: "INV",
    default_tax_rate: 0,
    currency_code: "USD",
    terms_template: "",
  });
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [initial, setInitial] = useState(null);
  const [profile, setProfile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });
  const [showPassword, setShowPassword] = useState(false);

  const cx = (...c) => c.filter(Boolean).join(" ");

  const dirty = useMemo(() => {
    if (!initial || !profile) return false;
    const keys = [
      "company_name", "company_email", "company_mobile",
      "address1", "address2", "city", "state", "zip_code",
      "tax_rate", "status", "username", "email",
      "terms_and_conditions",
    ];
    for (const k of keys) {
      if ((initial[k] ?? "") !== (profile[k] ?? "")) return true;
    }
    if (profile.logoFile) return true;
    return false;
  }, [initial, profile]);

  const initials = (name) =>
    name ? name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2) : "";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, cs] = await Promise.all([
          getCompanyProfile(),
          getCompanySettings().catch(() => null),
        ]);
        if (!alive) return;
        if (cs) {
          setReminderSettings({
            reminder_enabled: !!cs.reminder_enabled,
            reminder_frequency_days: cs.reminder_frequency_days ?? 7,
            reminder_max_count: cs.reminder_max_count ?? 3,
          });
          const coName  = data?.company_name  || data?.full_name  || "";
          const coEmail = data?.company_email || data?.email || "";
          setInvoiceSettings({
            invoice_prefix: cs.invoice_prefix || "INV",
            default_tax_rate: Number(cs.default_tax_rate ?? 0),
            currency_code: cs.currency_code || "USD",
            terms_template: cs.terms_template || getDefaultTerms(coName, coEmail),
          });
        }
        const coName  = data?.company_name  || data?.full_name  || "";
        const coEmail = data?.company_email || data?.email || "";
        const prefilled = {
          ...data,
          username: data.username || "",
          email: data.company_email || "",
          password: "",
          terms_and_conditions: data.terms_and_conditions || getDefaultTerms(coName, coEmail),
        };
        setInitial(prefilled);
        setProfile(prefilled);
        setLogoPreview(data.logo_url || null);
      } catch {
        if (!alive) return;
        setInitial({});
        setProfile({
          company_name: "", company_email: "", company_mobile: "",
          address1: "", address2: "", city: "", state: "", zip_code: "",
          tax_rate: "", status: "Active", username: "", email: "", password: "",
          logoFile: null, terms_and_conditions: getDefaultTerms("Your Company", ""),
        });
        setLogoPreview(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: name === "tax_rate" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfile((prev) => ({ ...prev, logoFile: file }));
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const resetChanges = () => {
    setProfile({ ...initial, username: initial.username || "", email: initial.company_email || "", password: "" });
    setLogoPreview(initial?.logo_url || null);
  };

  const buildFormData = (obj) => {
    const fd = new FormData();
    if (obj.logoFile instanceof File) fd.append("logoFile", obj.logoFile);
    [
      "company_name", "company_email", "company_mobile",
      "address1", "address2", "city", "state", "zip_code",
      "tax_rate", "status", "username", "email", "password",
      "terms_and_conditions",
    ].forEach((k) => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
    });
    return fd;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...profile };
      delete payload.logo_url;
      delete payload.db_name;
      delete payload.updated_at;
      if (!payload.password) delete payload.password;
      const updated = await updateCompanyProfile(buildFormData(payload));
      setInitial(updated);
      setProfile({ ...updated, username: updated.username || "", email: updated.company_email || "", password: "" });
      setLogoPreview(updated.logo_url || null);
      setToast({ show: true, type: "success", msg: "Profile updated" });
      setEditing(false);
    } catch {
      setToast({ show: true, type: "error", msg: "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = buildFormData(profile);
      const created = await updateCompanyProfile(fd);
      setInitial(created);
      setProfile({ ...created, username: created.username || "", email: created.company_email || "", password: "" });
      setLogoPreview(created.logo_url || null);
      setToast({ show: true, type: "success", msg: "Company profile created" });
      setEditing(false);
    } catch {
      setToast({ show: true, type: "error", msg: "Failed to create company profile" });
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="grid place-items-center h-64 text-gray-500">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" />
          <span>Loading profile…</span>
        </div>
      </div>
    );
  }

  const profileExists = !!initial && Object.keys(initial).length > 0;

  // ── Tab content renderers ─────────────────────────────────────────────────

  const field = (props) => (
    <input
      {...props}
      disabled={props.disabled ?? !editing}
      className={cx(
        "border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-400",
        (props.disabled ?? !editing) ? "bg-gray-50 text-gray-500" : "bg-white"
      )}
    />
  );

  const tabCompany = (create = false) => (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-xl object-cover ring-1 ring-gray-200" />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-blue-100 ring-1 ring-gray-200 grid place-items-center text-blue-700 font-bold text-lg">
              {initials(profile.company_name)}
            </div>
          )}
          {(create || editing) && (
            <label className="absolute -bottom-2 -right-2 cursor-pointer inline-flex items-center justify-center h-9 w-9 rounded-full bg-white shadow border hover:bg-gray-50">
              <Camera size={16} />
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 w-full">
          {field({ type: "text",  name: "company_name",   value: profile.company_name   || "", onChange: handleChange, placeholder: "Company Name",   ...(create ? { disabled: false } : {}) })}
          {field({ type: "email", name: "company_email",  value: profile.company_email  || "", onChange: handleChange, placeholder: "Company Email",  ...(create ? { disabled: false } : {}) })}
          {field({ type: "text",  name: "company_mobile", value: profile.company_mobile || "", onChange: handleChange, placeholder: "Mobile Number",  ...(create ? { disabled: false } : {}) })}
          <select
            name="status"
            value={profile.status || "Active"}
            onChange={handleChange}
            disabled={create ? false : !editing}
            className={cx(
              "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400",
              (!create && !editing) ? "bg-gray-50 text-gray-500" : "bg-white"
            )}
          >
            {["Active", "Deactivated", "Blacklisted"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const tabAddress = (create = false) => (
    <div className="grid gap-4 md:grid-cols-2">
      {field({ type: "text",   name: "address1",  value: profile.address1  || "", onChange: handleChange, placeholder: "Address Line 1", ...(create ? { disabled: false } : {}) })}
      {field({ type: "text",   name: "address2",  value: profile.address2  || "", onChange: handleChange, placeholder: "Address Line 2", ...(create ? { disabled: false } : {}) })}
      {field({ type: "text",   name: "city",      value: profile.city      || "", onChange: handleChange, placeholder: "City",            ...(create ? { disabled: false } : {}) })}
      {field({ type: "text",   name: "state",     value: profile.state     || "", onChange: handleChange, placeholder: "State",           ...(create ? { disabled: false } : {}) })}
      {field({ type: "text",   name: "zip_code",  value: profile.zip_code  || "", onChange: handleChange, placeholder: "Zip Code",        ...(create ? { disabled: false } : {}) })}
      {field({ type: "number", name: "tax_rate",  value: profile.tax_rate  ?? "",  onChange: handleChange, placeholder: "Tax Rate (%)",   step: "0.01", ...(create ? { disabled: false } : {}) })}
    </div>
  );

  const tabReminders = () => (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Configure automatic reminder frequency for overdue invoices.</p>
      <div className="grid gap-4 md:grid-cols-3 items-end">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reminderSettings.reminder_enabled}
              onChange={(e) => setReminderSettings((s) => ({ ...s, reminder_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
          <span className="text-sm font-medium text-gray-700">
            {reminderSettings.reminder_enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Frequency</label>
          <select
            value={reminderSettings.reminder_frequency_days}
            onChange={(e) => setReminderSettings((s) => ({ ...s, reminder_frequency_days: Number(e.target.value) }))}
            disabled={!reminderSettings.reminder_enabled}
            className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none"
          >
            <option value={3}>Every 3 days</option>
            <option value={7}>Every 7 days</option>
            <option value={14}>Every 14 days</option>
            <option value={30}>Every 30 days</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max reminders</label>
          <select
            value={reminderSettings.reminder_max_count}
            onChange={(e) => setReminderSettings((s) => ({ ...s, reminder_max_count: Number(e.target.value) }))}
            disabled={!reminderSettings.reminder_enabled}
            className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none"
          >
            <option value={1}>1 reminder</option>
            <option value={2}>2 reminders</option>
            <option value={3}>3 reminders</option>
            <option value={5}>5 reminders</option>
          </select>
        </div>
      </div>
      {reminderSettings.reminder_enabled && (
        <p className="text-xs text-gray-500">
          Reminders will be sent every <strong>{reminderSettings.reminder_frequency_days} days</strong>, up to{" "}
          <strong>{reminderSettings.reminder_max_count}×</strong> per invoice.
        </p>
      )}
      <button
        onClick={async () => {
          setSavingReminder(true);
          try {
            await updateReminderSettings(reminderSettings);
            setToast({ show: true, type: "success", msg: "Reminder settings saved." });
          } catch {
            setToast({ show: true, type: "error", msg: "Failed to save reminder settings." });
          } finally {
            setSavingReminder(false);
          }
        }}
        disabled={savingReminder}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {savingReminder && <Loader2 size={14} className="animate-spin" />}
        Save Reminder Settings
      </button>
    </div>
  );

  const tabInvoices = () => (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Configure invoice numbering, tax defaults, and currency for this company.</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Invoice prefix</label>
          <input
            type="text"
            value={invoiceSettings.invoice_prefix}
            onChange={(e) => setInvoiceSettings((s) => ({ ...s, invoice_prefix: e.target.value.toUpperCase() }))}
            maxLength={10}
            placeholder="INV"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1">e.g. <span className="font-mono">INV-202506-00001</span></p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Default tax rate (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={invoiceSettings.default_tax_rate}
            onChange={(e) => setInvoiceSettings((s) => ({ ...s, default_tax_rate: Number(e.target.value) }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Currency</label>
          <select
            value={invoiceSettings.currency_code}
            onChange={(e) => setInvoiceSettings((s) => ({ ...s, currency_code: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="AUD">AUD — Australian Dollar</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="NPR">NPR — Nepalese Rupee</option>
            <option value="AED">AED — UAE Dirham</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Terms & conditions (for PDF)</label>
        <textarea
          value={invoiceSettings.terms_template}
          onChange={(e) => setInvoiceSettings((s) => ({ ...s, terms_template: e.target.value }))}
          rows={8}
          placeholder="Enter your standard terms & conditions. These will appear on every invoice PDF…"
          className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-blue-400"
        />
        <p className="text-xs text-gray-400 mt-1">Leave blank to use the default boilerplate.</p>
      </div>
      <button
        onClick={async () => {
          setSavingInvoice(true);
          try {
            await updateInvoiceSettings(invoiceSettings);
            setToast({ show: true, type: "success", msg: "Invoice settings saved." });
          } catch {
            setToast({ show: true, type: "error", msg: "Failed to save invoice settings." });
          } finally {
            setSavingInvoice(false);
          }
        }}
        disabled={savingInvoice}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 transition-colors"
      >
        {savingInvoice && <Loader2 size={14} className="animate-spin" />}
        Save Invoice Settings
      </button>
    </div>
  );

  const tabLegal = (create = false) => (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">This will be auto-filled on every invoice you generate. You can still edit it per invoice.</p>
      <textarea
        name="terms_and_conditions"
        value={profile.terms_and_conditions || ""}
        onChange={handleChange}
        disabled={create ? false : !editing}
        rows={12}
        placeholder="Enter your terms & conditions…"
        className={cx(
          "w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-blue-400",
          (!create && !editing) ? "bg-gray-50 text-gray-500" : "bg-white"
        )}
      />
    </div>
  );

  const tabSecurity = (create = false) => (
    <div className="grid gap-4 md:grid-cols-2">
      {field({ type: "text",  name: "username", value: profile.username || "", onChange: handleChange, placeholder: "Username",    ...(create ? { disabled: false } : {}) })}
      {field({ type: "email", name: "email",    value: profile.email    || "", onChange: handleChange, placeholder: "Login Email", ...(create ? { disabled: false } : {}) })}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          value={profile.password || ""}
          onChange={handleChange}
          placeholder="Password"
          disabled={create ? false : !editing}
          className={cx(
            "border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-400",
            (!create && !editing) ? "bg-gray-50 text-gray-500" : "bg-white"
          )}
        />
        {(create || editing) && (
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );

  const tabContent = (create = false) => ({
    company:   tabCompany(create),
    address:   tabAddress(create),
    invoices:  tabInvoices(),
    reminders: tabReminders(),
    legal:     tabLegal(create),
    security:  tabSecurity(create),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {toast.show && (
        <DialogBox message={toast.msg} type={toast.type} onClose={() => setToast((t) => ({ ...t, show: false }))} />
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {profileExists ? profile.company_name || "Company Profile" : "Company Setup"}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {profileExists ? "Manage your company settings." : "Complete your company profile to start invoicing."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {profileExists ? (
            !editing ? (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm border-gray-200 hover:bg-gray-50 text-gray-600"
              >
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={resetChanges}
                  disabled={!dirty || saving}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                    dirty && !saving ? "border-gray-200 hover:bg-gray-50 text-gray-600" : "border-gray-100 text-gray-300 cursor-not-allowed"
                  )}
                >
                  <RefreshCw size={14} /> Reset
                </button>
                <button
                  type="submit"
                  form="profile-form"
                  disabled={!dirty || saving}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow transition",
                    dirty && !saving ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
                  )}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </>
            )
          ) : (
            <button
              type="submit"
              form="create-form"
              disabled={!dirty || saving}
              className={cx(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow transition",
                (!dirty || saving) ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isMaster ? "Create Company" : "Save Setup"}
            </button>
          )}
        </div>
      </div>

      {profileExists ? (
        <form id="profile-form" onSubmit={handleUpdate}>
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cx(
                    "flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeTab === id
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab panel */}
            <div className="p-6">
              {tabContent()[activeTab]}
            </div>
          </div>
        </form>
      ) : (
        <form id="create-form" onSubmit={isMaster ? handleCreate : handleUpdate}>
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cx(
                    "flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeTab === id
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {tabContent(true)[activeTab]}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
