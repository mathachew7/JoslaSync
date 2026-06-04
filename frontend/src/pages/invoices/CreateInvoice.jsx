import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { listClients } from "../../api/clients";
import { getCompanyProfile } from "../../api/company";
import { createInvoice } from "../../api/invoices";
import { useAuth } from "../../context/AuthContext";
import DialogBox from "../../components/DialogBox";

// ── helpers ──────────────────────────────────────────────────────────────────

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const todayIso = () => new Date().toISOString().split("T")[0];

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const parseApiError = (err) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Unknown error.";
  if (Array.isArray(detail))
    return detail.map((d) => `${(d.loc || []).join(".")}: ${d.msg}`).join("\n");
  return typeof detail === "string" ? detail : JSON.stringify(detail);
};

// ── component ─────────────────────────────────────────────────────────────────

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Company + clients
  const [company, setCompany]           = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [clients, setClients]           = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Core invoice fields
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceDate, setInvoiceDate]   = useState(todayIso());
  const [dueDate, setDueDate]           = useState(addDays(todayIso(), 15));
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState([
    { description: "", quantity: 1, price: 0 },
  ]);

  // Discount
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType]       = useState("PERCENT");
  const [discountValue, setDiscountValue]     = useState(0);

  // Tax
  const [taxRate, setTaxRate] = useState(0);

  // Notes
  const [footerMessage, setFooterMessage]               = useState("Thank you for your business!");
  const [additionalInfo, setAdditionalInfo]             = useState("");
  const [additionalInfoOpen, setAdditionalInfoOpen]     = useState(false);

  // Logo for PDF — auto-loaded from company profile
  const [logoDataUrl, setLogoDataUrl] = useState("");

  // UI
  const [saving, setSaving]           = useState(false);
  const [submitted, setSubmitted]     = useState(false); // show errors only after first submit attempt
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogType, setDialogType]   = useState("success");

  // ── data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    (async () => {
      setCompanyLoading(true);
      try {
        const data = await getCompanyProfile();
        if (!alive) return;
        setCompany(data ?? null);
        const tr = Number(data?.tax_rate);
        if (Number.isFinite(tr) && tr > 0) setTaxRate(tr);
        if (data?.state) setPlaceOfSupply(data.state);
        if (data?.logo_url) {
          try {
            const res = await fetch(data.logo_url);
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = () => { if (alive) setLogoDataUrl(String(reader.result || "")); };
            reader.readAsDataURL(blob);
          } catch { /* logo optional */ }
        }
      } catch { /* company profile optional */ }
      finally { if (alive) setCompanyLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setClientsLoading(true);
      try {
        let all = [], page = 1;
        while (true) {
          const res = await listClients({ page, page_size: 100 });
          all = [...all, ...(res.data ?? [])];
          if (all.length >= (res.meta?.total ?? all.length)) break;
          page++;
        }
        if (alive) setClients(all);
      } catch { /* silently fail */ }
      finally { if (alive) setClientsLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // ── derived values ────────────────────────────────────────────────────────

  const currentClient = useMemo(
    () => clients.find((c) => String(c.id) === String(selectedClientId)),
    [clients, selectedClientId]
  );

  // Keep due date at least on invoice date when invoice date changes
  useEffect(() => {
    if (dueDate && dueDate < invoiceDate) setDueDate(invoiceDate);
  }, [invoiceDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill tax rate from client's default when a client is selected
  useEffect(() => {
    if (!currentClient) return;
    if (currentClient.default_tax_rate != null && Number(currentClient.default_tax_rate) > 0) {
      setTaxRate(Number(currentClient.default_tax_rate));
    }
    if (currentClient.state && !placeOfSupply) {
      setPlaceOfSupply(currentClient.state);
    }
  }, [currentClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = lineItems.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0
  );
  const discountAmount = useMemo(() => {
    if (!discountEnabled || !(Number(discountValue) > 0)) return 0;
    return discountType === "PERCENT"
      ? (subtotal * Number(discountValue)) / 100
      : Number(discountValue);
  }, [discountEnabled, discountType, discountValue, subtotal]);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount     = (taxableAmount * (Number(taxRate) || 0)) / 100;
  const total         = taxableAmount + taxAmount;

  const validItems = lineItems.filter(
    (li) => (li.description || "").trim() && Number(li.quantity) > 0 && Number(li.price) > 0
  );
  const hasValidItem = validItems.length > 0;
  const isValid = Boolean(selectedClientId) && hasValidItem;

  // ── event handlers ────────────────────────────────────────────────────────

  const onLineChange = (idx, field, value) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: field === "description" ? value : Math.max(0, parseFloat(value) || 0),
      };
      return next;
    });
  };

  const addLine   = () => setLineItems((p) => [...p, { description: "", quantity: 1, price: 0 }]);
  const removeLine = (idx) => setLineItems((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const handleSave = async () => {
    setSubmitted(true);
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const companyId = company?.id ?? null;
      const payload = {
        client_id:    String(selectedClientId),
        ...(companyId != null ? { company_id: companyId } : {}),
        invoice_date: invoiceDate,
        due_date:     dueDate || undefined,
        place_of_supply: placeOfSupply || undefined,
        invoice_title: invoiceTitle.trim() || undefined,

        discount_enabled: discountEnabled,
        discount_type:    discountEnabled ? discountType : undefined,
        discount_value:   discountEnabled ? Math.max(0, Number(discountValue)) : 0,
        tax_rate:         Number(taxRate) || 0,

        footer_message:            footerMessage || "",
        additional_information_raw: additionalInfo || "",

        items: validItems.map((li, idx) => ({
          sno: idx + 1,
          description: li.description.trim(),
          quantity:    Number(li.quantity),
          unit_price:  Number(li.price),
        })),

        created_by_user_id: user?.id ? String(user.id) : undefined,
        created_by_name:    company?.full_name || user?.username || undefined,
      };

      const created = await createInvoice(payload);
      navigate(`/invoices/${created.id}`, { replace: true });
    } catch (err) {
      setDialogType("error");
      setDialogMessage(parseApiError(err));
      setDialogOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  const errClass = (cond) =>
    `w-full border rounded px-3 py-2 text-sm focus:outline-none ${
      cond ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-blue-400"
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {dialogOpen && (
        <DialogBox message={dialogMessage} type={dialogType} onClose={() => setDialogOpen(false)} />
      )}

      {/* ── Header card ── */}
      <div className="bg-white shadow rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">New Invoice</h2>
        </div>

        {/* Company context strip */}
        {companyLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Loading company…
          </div>
        ) : company ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
            <span><span className="font-medium text-gray-700">{company.company_name}</span></span>
            {company.company_email && <span>{company.company_email}</span>}
            {company.company_mobile && <span>{company.company_mobile}</span>}
          </div>
        ) : (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Company profile not set up — PDF will have missing issuer details.{" "}
            <button onClick={() => navigate("/user-profile")} className="underline font-medium">
              Set up now →
            </button>
          </div>
        )}

        {/* Client + Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Client */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={clientsLoading}
              className={errClass(submitted && !selectedClientId)}
            >
              <option value="">
                {clientsLoading ? "Loading clients…" : "Select a client…"}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
            {submitted && !selectedClientId && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Client is required.
              </p>
            )}
            {/* Client address preview */}
            {currentClient && (
              <p className="text-xs text-gray-400 mt-1 leading-4">
                {[currentClient.address_line1, currentClient.city, currentClient.state, currentClient.postal_code]
                  .filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {/* Invoice date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              min={invoiceDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Title + Place of Supply */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Invoice Title <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={invoiceTitle}
              onChange={(e) => setInvoiceTitle(e.target.value)}
              placeholder="e.g. Web Design – July 2025"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Place of Supply <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder="e.g. MO"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Logo auto-loaded from company profile */}
        {logoDataUrl && (
          <div className="flex items-center gap-3">
            <img src={logoDataUrl} alt="Company logo" className="h-10 object-contain border rounded" />
            <span className="text-xs text-gray-400">Logo from company profile</span>
          </div>
        )}
      </div>

      {/* ── Line items ── */}
      <div className="bg-white shadow rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Line Items</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="py-2 px-3 text-left border-b">Description</th>
                <th className="py-2 px-3 text-center border-b w-24">Qty</th>
                <th className="py-2 px-3 text-center border-b w-36">Unit Price</th>
                <th className="py-2 px-3 text-right border-b w-32">Total</th>
                <th className="py-2 px-3 border-b w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => {
                const rowTotal   = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                const descEmpty  = submitted && !(item.description || "").trim();
                const qtyBad     = submitted && (Number(item.quantity) || 0) <= 0;
                const priceBad   = submitted && (Number(item.price) || 0) <= 0;
                return (
                  <tr key={idx} className="border-b last:border-none">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => onLineChange(idx, "description", e.target.value)}
                        placeholder="Description (required)"
                        className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none ${descEmpty ? "border-red-400" : "border-gray-300 focus:border-blue-400"}`}
                      />
                      {descEmpty && <p className="text-xs text-red-500 mt-0.5">Required.</p>}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        value={item.quantity}
                        min="0"
                        onChange={(e) => onLineChange(idx, "quantity", e.target.value)}
                        className={`w-full border rounded px-2 py-1.5 text-sm text-center focus:outline-none ${qtyBad ? "border-red-400" : "border-gray-300 focus:border-blue-400"}`}
                      />
                      {qtyBad && <p className="text-xs text-red-500 mt-0.5 text-center">&gt; 0</p>}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        value={item.price}
                        min="0"
                        step="0.01"
                        onChange={(e) => onLineChange(idx, "price", e.target.value)}
                        className={`w-full border rounded px-2 py-1.5 text-sm text-center focus:outline-none ${priceBad ? "border-red-400" : "border-gray-300 focus:border-blue-400"}`}
                      />
                      {priceBad && <p className="text-xs text-red-500 mt-0.5 text-center">&gt; 0</p>}
                    </td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums">
                      {fmtMoney(rowTotal)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => removeLine(idx)}
                        disabled={lineItems.length === 1}
                        className={lineItems.length === 1 ? "text-gray-300 cursor-not-allowed" : "text-red-400 hover:text-red-600"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={addLine}
          className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-3 py-1.5 hover:bg-blue-50"
        >
          <Plus size={14} /> Add Line
        </button>

        {submitted && !hasValidItem && (
          <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle size={14} /> At least one item needs a description, qty &gt; 0, and price &gt; 0.
          </p>
        )}
      </div>

      {/* ── Discount & Tax ── */}
      <div className="bg-white shadow rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pricing</h2>

        {/* Discount */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => setDiscountEnabled(e.target.checked)}
              className="rounded"
            />
            Apply Discount
          </label>
          {discountEnabled && (
            <>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
              >
                <option value="PERCENT">Percent (%)</option>
                <option value="FLAT">Flat ($)</option>
              </select>
              <input
                type="number"
                value={discountValue}
                min="0"
                step={discountType === "PERCENT" ? "1" : "0.01"}
                onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 focus:outline-none"
              />
            </>
          )}
        </div>

        {/* Tax */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-600 w-16">Tax (%)</label>
          <input
            type="number"
            value={taxRate}
            min="0"
            max="100"
            step="0.01"
            onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 focus:outline-none"
          />
        </div>

        {/* Totals summary */}
        <div className="border-t pt-3 space-y-1 text-sm text-gray-700 max-w-xs ml-auto">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmtMoney(subtotal)}</span>
          </div>
          {discountEnabled && discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount {discountType === "PERCENT" ? `(${discountValue}%)` : "(flat)"}</span>
              <span className="tabular-nums">−{fmtMoney(discountAmount)}</span>
            </div>
          )}
          {Number(taxRate) > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Tax ({taxRate}%)</span>
              <span className="tabular-nums">{fmtMoney(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base text-gray-900 border-t pt-1">
            <span>Total</span>
            <span className="tabular-nums">{fmtMoney(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="bg-white shadow rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Footer Message</label>
          <textarea
            value={footerMessage}
            onChange={(e) => setFooterMessage(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>

        {/* Additional info collapsible */}
        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setAdditionalInfoOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-600"
          >
            Additional Information
            {additionalInfoOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {additionalInfoOpen && (
            <div className="p-4 bg-white border-t">
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={4}
                placeholder="e.g. Installed reinforced door, mounted LED screen…"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pb-6">
        <button
          type="button"
          onClick={() => navigate("/invoices")}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2 text-sm rounded text-white shadow transition ${
            saving ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Creating…
            </span>
          ) : (
            "Create Invoice"
          )}
        </button>
      </div>
    </div>
  );
}
