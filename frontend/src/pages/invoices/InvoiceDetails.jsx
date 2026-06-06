// src/pages/InvoiceDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { getInvoiceById, updateInvoice, voidInvoice, deleteInvoice, cloneInvoice, issueInvoice, recordPayment, adjustPayment, sendInvoiceEmail, sendReminder } from "../../api/invoices";
import { getCompanyProfile, getCompanySettings } from "../../api/company";
import { getClient } from "../../api/clients";
import { generateInvoicePdf } from "../../utils/generateInvoicePdf";
import DialogBox from "../../components/DialogBox";
import {
  ArrowLeft,
  Download,
  Building2,
  User2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Percent,
  FileText,
  MapPinned,
  UserCircle2,
  Pencil,
  Save,
  X,
  ShieldAlert,
  Plus,
  Trash2,
  Copy as CopyIcon,
  Send,
} from "lucide-react";

/* --------------------- helpers --------------------- */
const fmtCurrency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(Number(n)) ? Number(n) : 0
  );
const fmtDate = (iso) => (!iso ? "—" : new Date(`${iso}T00:00:00`).toLocaleDateString());

const statusPill = (status) => {
  const s = (status || "INVOICE").toUpperCase();
  if (s === "VOID") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (s === "DRAFT") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
};

// prefer the first truthy string
const first = (...vals) => {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
};

// normalize company → UI shape
function normalizeCompany(companyLike) {
  if (!companyLike) return null;
  return {
    name: first(companyLike.company_name, companyLike.full_name, companyLike.name, companyLike.company),
    email: first(companyLike.company_email, companyLike.email),
    phone: first(companyLike.company_mobile, companyLike.phone),
    line1: first(companyLike.address1, companyLike.address_line1),
    line2: first(companyLike.address2, companyLike.address_line2),
    city: first(companyLike.city),
    state: first(companyLike.state),
    zip: first(companyLike.zip_code, companyLike.postal_code, companyLike.zip),
    country: first(companyLike.country),
    logo_url: first(companyLike.logo_url),
  };
}

// normalize client → UI shape
function normalizeClient(clientLike) {
  if (!clientLike) return null;
  return {
    name: first(clientLike.name, clientLike.full_name, clientLike.company),
    company: first(clientLike.company),
    email: first(clientLike.email),
    phone: first(clientLike.phone),
    // main address line (prefer billing; then shipping)
    line1: first(clientLike.address_line1, clientLike.address1, clientLike.shipping_address1),
    line2: first(clientLike.address_line2, clientLike.address2, clientLike.shipping_address2),
    city: first(clientLike.city, clientLike.shipping_city),
    state: first(clientLike.state, clientLike.shipping_state),
    zip: first(clientLike.postal_code, clientLike.zip_code, clientLike.shipping_zip),
    country: first(clientLike.country, clientLike.shipping_country),
  };
}

/* --------------------- component --------------------- */
export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const passed = location.state || {};
  const [invoice, setInvoice] = useState(passed.invoice || null);

  // hydrated/expanded fallbacks
  const [hydratedClient, setHydratedClient] = useState(null);
  const [hydratedCompany, setHydratedCompany] = useState(null);

  const [loading, setLoading] = useState(!passed.invoice);
  const [error, setError] = useState("");

  // toast dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogType, setDialogType] = useState("success");

  // confirm dialog (custom, non-browser)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'void' | 'delete' | 'clone'
  const [confirmLoading, setConfirmLoading] = useState(false);

  // edit mode state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  // amendment (finalized invoice override)
  const [amendModalOpen, setAmendModalOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [editNote, setEditNote] = useState("");

  // payment state
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);

  // reminder state
  const [reminderConfig, setReminderConfig] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  // send email state
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [sending, setSending] = useState(false);

  /* fetch invoice */
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const [data, cs] = await Promise.all([
          getInvoiceById(id, { expand: ["company", "client", "items"] }),
          getCompanySettings().catch(() => null),
        ]);
        if (!ignore) {
          setInvoice(data);
          if (cs) setReminderConfig(cs);
        }
      } catch {
        if (!ignore) setError("Failed to load invoice.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => (ignore = true);
  }, [id]);

  // auto-enter edit if we navigated here after cloning
  useEffect(() => {
    if (invoice && location.state?.autoEdit && !editMode) {
      enterEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice]);

  /* hydrate client if not expanded */
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!invoice) return;
      if (invoice.client && invoice.client.name) {
        setHydratedClient(null);
        return;
      }
      if (invoice.client_id) {
        try {
          const c = await getClient(String(invoice.client_id));
          if (!ignore) setHydratedClient(c || null);
        } catch {
          if (!ignore) setHydratedClient(null);
        }
      }
    })();
    return () => (ignore = true);
  }, [invoice]);

  /* hydrate company if not expanded (safe optional fallback) */
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!invoice) return;
      if (invoice.company && (invoice.company.company_name || invoice.company.full_name)) {
        setHydratedCompany(null);
        return;
      }
      try {
        const cp = await getCompanyProfile();
        if (!ignore) setHydratedCompany(cp || null);
      } catch {
        if (!ignore) setHydratedCompany(null);
      }
    })();
    return () => (ignore = true);
  }, [invoice]);

  /* normalized entities for UI */
  const companyUI = useMemo(() => {
    const fromInvoice = normalizeCompany(invoice?.company);
    if (fromInvoice) return fromInvoice;
    const fromHydrated = normalizeCompany(hydratedCompany);
    if (fromHydrated) return fromHydrated;
    if (passed.payloadForPdf) {
      return {
        name: first(passed.payloadForPdf.companyName),
        email: first(passed.payloadForPdf.companyEmail),
        phone: first(passed.payloadForPdf.companyMobile),
        line1: first(passed.payloadForPdf.companyAddress1),
        line2: first(passed.payloadForPdf.companyAddress2),
        city: "",
        state: first(passed.payloadForPdf.pos),
        zip: "",
        country: "",
        logo_url: first(passed.payloadForPdf.companyLogoDataUrl),
      };
    }
    return {
      name: "",
      email: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      logo_url: "",
    };
  }, [invoice, hydratedCompany, passed]);

  const clientUI = useMemo(() => {
    const fromInvoice = normalizeClient(invoice?.client);
    if (fromInvoice) return fromInvoice;
    const fromHydrated = normalizeClient(hydratedClient);
    if (fromHydrated) return fromHydrated;
    if (passed.payloadForPdf) {
      return {
        name: first(passed.payloadForPdf.selectedClient),
        company: first(passed.payloadForPdf.clientCompany),
        email: first(passed.payloadForPdf.clientEmail),
        phone: first(passed.payloadForPdf.clientPhone),
        line1: first(passed.payloadForPdf.clientAddress1),
        line2: first(passed.payloadForPdf.clientAddress2),
        city: first(passed.payloadForPdf.clientCity),
        state: first(passed.payloadForPdf.clientState),
        zip: first(passed.payloadForPdf.clientZip),
        country: first(passed.payloadForPdf.clientCountry),
      };
    }
    return {
      name: "",
      company: "",
      email: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
    };
  }, [invoice, hydratedClient, passed]);

  // pre-fill send modal from client data (must be after clientUI is defined)
  useEffect(() => {
    if (clientUI?.email) setSendEmail(clientUI.email);
    if (clientUI?.name) setSendName(clientUI.name);
  }, [clientUI]);

  /* derive totals (view mode → prefer server; edit mode → live compute) */
  const itemsView = invoice?.items || [];
  const subtotalView = Number(
    invoice?.subtotal ??
      itemsView.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  );
  const discountEnabledView = Boolean(invoice?.discount_enabled);
  const discountTypeView =
    (invoice?.discount_type || "").toString().toLowerCase() === "percent" ? "percent" : "flat";
  const discountValueView = Number(invoice?.discount_value || 0);
  const discountAmountView =
    invoice?.discount_amount != null
      ? Number(invoice.discount_amount)
      : discountEnabledView
      ? discountTypeView === "percent"
        ? (subtotalView * discountValueView) / 100
        : discountValueView
      : 0;
  const discountedSubtotalView = Math.max(0, subtotalView - discountAmountView);
  const taxRateView = Number(invoice?.tax_rate || 0);
  const taxView =
    invoice?.tax_amount != null ? Number(invoice.tax_amount) : (discountedSubtotalView * taxRateView) / 100;
  const totalView = invoice?.total != null ? Number(invoice.total) : discountedSubtotalView + taxView;

  // edit-mode money math (mirrors CreateInvoice)
  const subtotalEdit = useMemo(() => {
    if (!form) return 0;
    return form.lineItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
      0
    );
  }, [form]);
  const discountAmountEdit = useMemo(() => {
    if (!form || !form.discountEnabled || !(Number(form.discountValue) > 0)) return 0;
    return form.discountType === "PERCENT"
      ? (subtotalEdit * Number(form.discountValue)) / 100
      : Number(form.discountValue);
  }, [form, subtotalEdit]);
  const discountedSubtotalEdit = Math.max(0, subtotalEdit - discountAmountEdit);
  const taxAmountEdit = useMemo(() => {
    if (!form) return 0;
    return (discountedSubtotalEdit * (Number(form.taxRate) || 0)) / 100;
  }, [form, discountedSubtotalEdit]);
  const totalEdit = discountedSubtotalEdit + taxAmountEdit;

  /* pdf payload uses normalized UI fields */
  const pdfPayload = useMemo(() => {
    const inv = invoice;
    if (passed.payloadForPdf) return passed.payloadForPdf;
    if (!inv) return null;

    return {
      status: inv.status || "INVOICE",
      invoiceNumber: inv.invoice_no,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      createdBy: inv.created_by_name || companyUI.name || "Company",
      pos: inv.place_of_supply || companyUI.state || "",
      companyName: companyUI.name || "Company",
      companyEmail: companyUI.email || "",
      companyMobile: companyUI.phone || "",
      companyAddress1: companyUI.line1 || "",
      companyAddress2: companyUI.line2 || "",
      companyLogoDataUrl: companyUI.logo_url || "",

      selectedClient: clientUI.name || "Client",
      clientCompany: clientUI.company || "",
      clientEmail: clientUI.email || "",
      clientPhone: clientUI.phone || "",
      clientAddress1: clientUI.line1 || "",
      clientAddress2: clientUI.line2 || "",
      clientCity: clientUI.city || "",
      clientState: clientUI.state || "",
      clientZip: clientUI.zip || "",
      clientCountry: clientUI.country || "US",

      shippingAddress1: clientUI.line1 || "",
      shippingAddress2: clientUI.line2 || "",
      shippingCity: clientUI.city || "",
      shippingState: clientUI.state || "",
      shippingZip: clientUI.zip || "",
      shippingCountry: clientUI.country || "US",

      invoiceTitle: inv.invoice_title || "",
      lineItems: (inv.items || []).map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        price: Number(it.unit_price) || 0,
      })),
      discountEnabled: discountEnabledView,
      discountType: discountTypeView,
      discountValue: discountValueView,
      subtotal: subtotalView,
      discountAmount: discountAmountView,
      tax: taxView,
      total: totalView,
      additionalInformation: inv.additional_information_raw || "",
      footerMessage: inv.footer_message || "Thank you for your business!",
    };
  }, [
    passed,
    invoice,
    companyUI,
    clientUI,
    discountEnabledView,
    discountTypeView,
    discountValueView,
    subtotalView,
    discountAmountView,
    taxView,
    totalView,
  ]);

  const handleViewPdf = async () => {
    if (!pdfPayload) {
      setDialogType("error");
      setDialogMessage("PDF data not ready yet. Please try again in a moment.");
      setDialogOpen(true);
      return;
    }
    let payload = pdfPayload;
    const rawLogo = pdfPayload.companyLogoDataUrl;
    if (rawLogo && !rawLogo.startsWith("data:")) {
      try {
        const res = await fetch(rawLogo);
        const blob = await res.blob();
        const b64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(blob);
        });
        payload = { ...pdfPayload, companyLogoDataUrl: b64 };
      } catch { /* skip logo if fetch fails */ }
    }
    generateInvoicePdf(payload);
  };

  const handleSend = async () => {
    if (!sendEmail || !pdfPayload) return;
    setSending(true);
    try {
      // generate PDF → get base64
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      // Re-use generateInvoicePdf internals via a blob approach
      let payload = pdfPayload;
      const rawLogo = pdfPayload.companyLogoDataUrl;
      if (rawLogo && !rawLogo.startsWith("data:")) {
        try {
          const res = await fetch(rawLogo);
          const blob = await res.blob();
          const b64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(blob);
          });
          payload = { ...pdfPayload, companyLogoDataUrl: b64 };
        } catch { /* skip */ }
      }
      // Use generateInvoicePdf to get blob output
      const pdfDoc = generateInvoicePdf(payload, { returnDoc: true });
      const pdfBase64 = pdfDoc
        ? pdfDoc.output("datauristring").split(",")[1]
        : "";

      await sendInvoiceEmail(invoice.id, {
        to_email: sendEmail,
        to_name: sendName || sendEmail,
        pdf_base64: pdfBase64,
        pdf_filename: `invoice-${invoice.invoice_no}.pdf`,
      });

      setSendOpen(false);
      setDialogType("success");
      setDialogMessage(`Invoice sent to ${sendEmail}`);
      setDialogOpen(true);
    } catch (e) {
      setDialogType("error");
      setDialogMessage(e?.response?.data?.detail || "Failed to send invoice.");
      setDialogOpen(true);
    } finally {
      setSending(false);
    }
  };

  /* edit-mode helpers */
  const buildForm = (inv) => ({
    invoice_title: inv.invoice_title || "",
    invoice_date: inv.invoice_date,
    due_date: inv.due_date || "",
    place_of_supply: inv.place_of_supply || "",
    discountEnabled: !!inv.discount_enabled,
    discountType: (inv.discount_type || "PERCENT").toUpperCase(),
    discountValue: Number(inv.discount_value || 0),
    taxRate: Number(inv.tax_rate || 0),
    footerMessage: inv.footer_message || "",
    additionalInformation: inv.additional_information_raw || "",
    lineItems: (inv.items || []).map((it) => ({
      description: it.description || "",
      quantity: Number(it.quantity) || 0,
      price: Number(it.unit_price) || 0,
    })),
  });

  const enterEdit = () => {
    if (!invoice) return;
    const statusUp = (invoice.status || "").toUpperCase();
    if (statusUp === "INVOICE") {
      // Finalized — require amendment reason first
      setAmendReason("");
      setAmendModalOpen(true);
    } else {
      setEditNote("");
      setForm(buildForm(invoice));
      setEditMode(true);
    }
  };

  const confirmAmend = () => {
    if (!amendReason.trim()) return;
    setEditNote(amendReason.trim());
    setAmendModalOpen(false);
    setForm(buildForm(invoice));
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setForm(null);
    setEditNote("");
  };

  const handleLineItemChange = (index, field, value) => {
    setForm((f) => {
      const next = { ...f };
      const updated = [...next.lineItems];
      updated[index][field] =
        field === "quantity" || field === "price"
          ? Math.max(0, parseFloat(value) || 0)
          : value;
      next.lineItems = updated;
      return next;
    });
  };
  const addLineItem = () =>
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, { description: "", quantity: 1, price: 0 }] }));
  const removeLineItem = (index) =>
    setForm((f) => {
      if (f.lineItems.length === 1) return f;
      return { ...f, lineItems: f.lineItems.filter((_, i) => i !== index) };
    });

  const buildPayloadFromForm = () => ({
    client_id: String(invoice.client_id),
    company_id: invoice.company_id ?? undefined,
    invoice_date: form.invoice_date,
    due_date: form.due_date || undefined,
    place_of_supply: form.place_of_supply || "",
    invoice_title: (form.invoice_title || "").trim() || undefined,

    discount_enabled: form.discountEnabled,
    discount_type: form.discountEnabled ? form.discountType : undefined,
    discount_value: form.discountEnabled ? Number(form.discountValue || 0) : 0,

    tax_rate: Number(form.taxRate || 0),

    footer_message: form.footerMessage || "",
    additional_information_raw: form.additionalInformation || "",

    items: form.lineItems
      .filter((li) => (li.description || "").trim() && Number(li.quantity) > 0 && Number(li.price) > 0)
      .map((li, idx) => ({
        sno: idx + 1,
        description: li.description.trim(),
        quantity: Number(li.quantity),
        unit_price: Number(li.price),
      })),
    ...(editNote ? { edit_note: editNote } : {}),
  });

  const validateFormHasItem = () =>
    form.lineItems.some(
      (li) => (li.description || "").trim() && Number(li.quantity) > 0 && Number(li.price) > 0
    );

  const onSave = async () => {
    if (!form || saving) return;
    if (!validateFormHasItem()) {
      setDialogType("error");
      setDialogMessage("Add at least one valid line item (desc + qty>0 + price>0).");
      setDialogOpen(true);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayloadFromForm();
      const updated = await updateInvoice(id, payload);
      setInvoice(updated);
      setEditMode(false);
      setForm(null);
      setDialogType("success");
      setDialogMessage("Invoice updated.");
      setDialogOpen(true);
    } catch (e) {
      setDialogType("error");
      setDialogMessage(e?.response?.data?.detail || "Failed to update invoice.");
      setDialogOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // Save draft edits then promote to INVOICE on the same record (no clone)
  const saveAndIssue = async () => {
    if (!form || saving) return;
    if (!validateFormHasItem()) {
      setDialogType("error");
      setDialogMessage("Add at least one valid line item (desc + qty>0 + price>0).");
      setDialogOpen(true);
      return;
    }

    setSaving(true);
    try {
      // 1) persist any in-form edits first
      const payload = buildPayloadFromForm();
      await updateInvoice(id, payload);

      // 2) promote DRAFT → INVOICE directly (same invoice, same number)
      const issued = await issueInvoice(id);
      setInvoice(issued);
      setEditMode(false);
      setForm(null);

      setDialogType("success");
      setDialogMessage(`Invoice #${issued.invoice_no} issued.`);
      setDialogOpen(true);
    } catch (e) {
      setDialogType("error");
      setDialogMessage(e?.response?.data?.detail || "Failed to issue invoice.");
      setDialogOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // open confirm modal instead of browser alert
  const askConfirm = (action) => {
    setConfirmAction(action); // 'void' | 'delete' | 'clone'
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction === "void") {
        const v = await voidInvoice(id);
        setInvoice(v);
        setEditMode(false);
        setForm(null);
        setDialogType("success");
        setDialogMessage("Invoice voided.");
        setDialogOpen(true);
      } else if (confirmAction === "delete") {
        await deleteInvoice(id);
        setDialogType("success");
        setDialogMessage("Invoice deleted.");
        setDialogOpen(true);
        navigate("/invoices");
      } else if (confirmAction === "clone") {
        // create a brand-new invoice on the server, then go edit it
        const newInv = await cloneInvoice(id, { status: "DRAFT" });
        setConfirmOpen(false);
        setConfirmAction(null);
        setDialogType("success");
        setDialogMessage(`Cloned as #${newInv.invoice_no}. Opening editor…`);
        setDialogOpen(true);
        navigate(`/invoices/${newInv.id}`, { state: { autoEdit: true } });
        return; // do not run close below twice
      }
      setConfirmOpen(false);
      setConfirmAction(null);
    } catch (err) {
      let msg = "Action failed.";
      if (confirmAction === "void") msg = "Failed to void invoice.";
      if (confirmAction === "delete") msg = "Failed to delete invoice.";
      if (confirmAction === "clone") msg = err?.response?.data?.detail || "Failed to clone invoice.";
      setDialogType("error");
      setDialogMessage(msg);
      setDialogOpen(true);
    } finally {
      setConfirmLoading(false);
    }
  };

  /* loading & error UI */
  if (loading && !invoice) {
    return (
      <div className="space-y-6">
        <div className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-white/80 backdrop-blur border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-200 animate-pulse" />
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-2xl shadow-sm">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
              {[...Array(5)].map((__, j) => (
                <div key={j} className="h-4 w-full bg-gray-100 rounded animate-pulse mb-2" />
              ))}
            </div>
          ))}
        </div>
        <div className="p-4 bg-white rounded-2xl shadow-sm">
          <div className="h-8 w-full bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6">
        <div className="text-red-600 mb-3">{error || "Invoice not found."}</div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Go Back
        </button>
      </div>
    );
  }

  /* --------------------- UI --------------------- */
  const statusUp = (invoice.status || "").toUpperCase();
  const isVoid = statusUp === "VOID";
  const isDraft = statusUp === "DRAFT";
  const isInvoice = statusUp === "INVOICE";
  const showItems = editMode ? form?.lineItems || [] : itemsView;

  return (
    <div className="space-y-6">
      {/* Sticky Bar */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-white/90 backdrop-blur border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg border hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gray-100 border flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <div className="text-sm text-gray-500">Invoice</div>
                <div className="font-semibold">#{invoice.invoice_no}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs rounded-full ${statusPill(invoice.status)}`}>
              {(invoice.status || "INVOICE").toString().toUpperCase()}
            </span>

            {/* VOID → Clone & Edit */}
            {!editMode && isVoid && (
              <button
                onClick={() => askConfirm("clone")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                title="Clone & Edit"
              >
                <CopyIcon size={18} />
                <span>Clone & Edit</span>
              </button>
            )}

            {/* DRAFT or INVOICE → Edit */}
            {!editMode && (isDraft || isInvoice) && (
              <button
                onClick={enterEdit}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 ${isInvoice ? "text-amber-700 border-amber-200 hover:bg-amber-50" : ""}`}
                title={isInvoice ? "Amend finalized invoice" : "Edit draft"}
              >
                <Pencil size={18} />
                <span>{isInvoice ? "Amend" : "Edit"}</span>
              </button>
            )}

            {/* INVOICE → Void */}
            {!editMode && !isVoid && !isDraft && (
              <button
                onClick={() => askConfirm("void")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 text-amber-700"
                title="Void invoice"
              >
                <ShieldAlert size={18} />
                <span>Void</span>
              </button>
            )}

            {editMode && (
              <>
                {isDraft && (
                  <>
                    <button
                      onClick={onSave}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${saving ? "bg-emerald-300" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
                    >
                      <Save size={18} />
                      <span>{saving ? "Saving…" : "Save Draft"}</span>
                    </button>
                    <button
                      onClick={saveAndIssue}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"} text-white`}
                    >
                      <CopyIcon size={18} />
                      <span>{saving ? "Issuing…" : "Save & Issue"}</span>
                    </button>
                  </>
                )}

                {isInvoice && (
                  <button
                    onClick={onSave}
                    disabled={saving}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${saving ? "bg-amber-300" : "bg-amber-600 hover:bg-amber-700"} text-white`}
                  >
                    <Save size={18} />
                    <span>{saving ? "Saving…" : "Save Amendment"}</span>
                  </button>
                )}

                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                >
                  <X size={18} />
                  <span>Cancel</span>
                </button>
              </>
            )}

            {/* Send by email — INVOICE only */}
            {!isVoid && !isDraft && !editMode && (
              <button
                onClick={() => setSendOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                <Send size={18} />
                <span>Send</span>
              </button>
            )}

            <button
              onClick={handleViewPdf}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
            >
              <Download size={18} />
              <span>View PDF</span>
            </button>
          </div>
        </div>
      </div>

      {isVoid && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 flex items-center gap-2">
          <ShieldAlert size={16} /> This invoice is VOID. Use <b>Clone &amp; Edit</b> to create an editable copy with a new number.
        </div>
      )}
      {isDraft && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-2">
          <Pencil size={16} /> This invoice is a DRAFT. You can edit and <b>Save &amp; Issue</b> to finalize with a new number.
        </div>
      )}

      {editMode && isInvoice && editNote && (
        <div className="p-3 rounded-lg border border-orange-300 bg-orange-50 text-orange-800 flex items-start gap-2">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Amending finalized invoice</span>
            <span className="text-orange-600"> — </span>
            <span className="italic">{editNote}</span>
            <span className="block text-xs text-orange-500 mt-0.5">This reason will be stored as an audit note on the invoice.</span>
          </div>
        </div>
      )}

      {!editMode && invoice.edit_note && (
        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 flex items-start gap-2 text-sm">
          <FileText size={15} className="shrink-0 mt-0.5 text-gray-400" />
          <span><span className="font-medium text-gray-700">Amendment note:</span> {invoice.edit_note}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-5 bg-white rounded-2xl shadow-sm border">
        <div className="grid lg:grid-cols-3 gap-6 items-center">
          {/* Company */}
          <div className="flex items-center gap-4">
            {companyUI.logo_url ? (
              <img
                src={companyUI.logo_url}
                alt="Company Logo"
                className="h-12 w-12 rounded-xl object-cover border"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-gray-100 border flex items-center justify-center">
                <Building2 size={20} />
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500">From</div>
              <div className="text-lg font-semibold">{companyUI.name || "—"}</div>
              {invoice.created_by_name ? (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <UserCircle2 size={12} />
                  <span>Created by {invoice.created_by_name}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Dates & POS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-gray-50 border">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar size={14} />
                Invoice Date
              </div>
              {editMode ? (
                <input
                  type="date"
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={form.invoice_date}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                />
              ) : (
                <div className="font-medium">{fmtDate(invoice.invoice_date)}</div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar size={14} />
                Due Date
              </div>
              {editMode ? (
                <input
                  type="date"
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={form.due_date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              ) : (
                <div className="font-medium">{fmtDate(invoice.due_date)}</div>
              )}
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border col-span-2">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <MapPinned size={14} />
                Place of Supply
              </div>
              {editMode ? (
                <input
                  type="text"
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={form.place_of_supply}
                  onChange={(e) => setForm((f) => ({ ...f, place_of_supply: e.target.value }))}
                />
              ) : (
                <div className="font-medium">
                  {first(invoice.place_of_supply, companyUI.state) || "—"}
                </div>
              )}
            </div>
          </div>

          {/* Amount + title */}
          <div className="text-right">
            <div className="text-xs text-gray-500">Amount Due</div>
            <div className="text-2xl font-extrabold tracking-tight">
              {fmtCurrency(editMode ? totalEdit : totalView)}
            </div>
            <div className="mt-1">
              {editMode ? (
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1 text-sm text-right"
                  placeholder="Invoice title (optional)"
                  value={form.invoice_title}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_title: e.target.value }))}
                />
              ) : invoice.invoice_title ? (
                <div className="text-sm text-gray-500 truncate">{invoice.invoice_title}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Company */}
        <div className="p-5 bg-white rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={18} />
            <div className="font-semibold">From (Your Company)</div>
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <div className="flex items-center gap-2">
              <Mail size={14} className="shrink-0 text-gray-400" />
              <span>{companyUI.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="shrink-0 text-gray-400" />
              <span>{companyUI.phone || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="shrink-0 text-gray-400 mt-0.5" />
              <div>
                {first([companyUI.line1, companyUI.line2].filter(Boolean).join(" ")) || "—"}
                <div className="text-gray-500">
                  {[companyUI.city, companyUI.state, companyUI.zip].filter(Boolean).join(", ") || ""}
                </div>
                {companyUI.country ? <div className="text-gray-500">{companyUI.country}</div> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="p-5 bg-white rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2 mb-3">
            <User2 size={18} />
            <div className="font-semibold">Bill To (Client)</div>
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <div className="font-medium">{clientUI.name || "—"}</div>
            {clientUI.company ? <div className="text-gray-600">{clientUI.company}</div> : null}
            <div className="flex items-center gap-2">
              <Mail size={14} className="shrink-0 text-gray-400" />
              <span>{clientUI.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="shrink-0 text-gray-400" />
              <span>{clientUI.phone || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="shrink-0 text-gray-400 mt-0.5" />
              <div>
                {first([clientUI.line1, clientUI.line2].filter(Boolean).join(" ")) || "—"}
                <div className="text-gray-500">
                  {[clientUI.city, clientUI.state, clientUI.zip].filter(Boolean).join(", ") || ""}
                </div>
                {clientUI.country ? <div className="text-gray-500">{clientUI.country}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items + Totals */}
      <div className="p-5 bg-white rounded-2xl shadow-sm border">
        {/* Items table */}
        <div className="overflow-x-auto">
          {!editMode ? (
            <table className="w-full text-sm border rounded-xl overflow-hidden">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="[&>th]:p-3 [&>th]:border-b [&>th]:font-semibold">
                  <th className="text-left">Description</th>
                  <th className="text-center w-24">Qty</th>
                  <th className="text-center w-40">Unit Price</th>
                  <th className="text-right w-48">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {itemsView.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No items.
                    </td>
                  </tr>
                ) : (
                  itemsView.map((it, idx) => {
                    const qty = Number(it.quantity) || 0;
                    const price = Number(it.unit_price) || 0;
                    const lineTotal = qty * price;
                    return (
                      <tr key={it.id ?? idx} className="odd:bg-white even:bg-gray-50 [&>td]:p-3 [&>td]:border-b">
                        <td className="text-gray-900">{it.description || "—"}</td>
                        <td className="text-center">{qty}</td>
                        <td className="text-center">{fmtCurrency(price)}</td>
                        <td className="text-right font-medium">{fmtCurrency(lineTotal)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm border rounded-xl overflow-hidden">
              <thead className="bg-gray-50 text-gray-600">
                <tr className="[&>th]:p-3 [&>th]:border-b [&>th]:font-semibold">
                  <th className="text-left">Description</th>
                  <th className="text-center w-24">Qty</th>
                  <th className="text-center w-40">Unit Price</th>
                  <th className="text-right w-48">Line Total</th>
                  <th className="text-center w-16">Remove</th>
                </tr>
              </thead>
              <tbody>
                {form.lineItems.map((item, index) => {
                  const rowTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                  const descEmpty = (item.description || "").trim().length === 0;
                  const qtyInvalid = (Number(item.quantity) || 0) <= 0;
                  const priceInvalid = (Number(item.price) || 0) <= 0;
                  return (
                    <tr key={index} className="odd:bg-white even:bg-gray-50 [&>td]:p-3 [&>td]:border-b text-center">
                      <td className="text-left">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                          className={`w-full border p-2 rounded ${descEmpty ? "border-red-300" : ""}`}
                          placeholder="Item description (required)"
                        />
                        {descEmpty && (
                          <div className="text-xs text-red-600 text-left mt-1">
                            Description is required.
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(index, "quantity", e.target.value)}
                          className={`w-20 border p-2 rounded text-center ${qtyInvalid ? "border-red-300" : ""}`}
                          min="0"
                        />
                        {qtyInvalid && <div className="text-xs text-red-600 mt-1">Qty &gt; 0</div>}
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleLineItemChange(index, "price", e.target.value)}
                          className={`w-28 border p-2 rounded text-center ${priceInvalid ? "border-red-300" : ""}`}
                          min="0"
                          step="0.01"
                        />
                        {priceInvalid && <div className="text-xs text-red-600 mt-1">Price &gt; 0</div>}
                      </td>
                      <td className="text-right font-medium pr-3">{fmtCurrency(rowTotal)}</td>
                      <td>
                        <button
                          onClick={() => removeLineItem(index)}
                          className={`${
                            form.lineItems.length === 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-red-500 hover:text-red-700"
                          }`}
                          disabled={form.lineItems.length === 1}
                          title={form.lineItems.length === 1 ? "At least one item is required" : "Remove"}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {editMode && (
          <button
            onClick={addLineItem}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow"
          >
            <Plus size={18} /> Add Item
          </button>
        )}

        {/* Totals panel */}
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {/* Notes */}
          <div className="space-y-4">
            {/* Footer message */}
            <div className="p-4 bg-gray-50 rounded-xl border">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Footer Message
              </div>
              {editMode ? (
                <textarea
                  rows={3}
                  className="w-full border rounded p-2 text-sm"
                  value={form.footerMessage}
                  onChange={(e) => setForm((f) => ({ ...f, footerMessage: e.target.value }))}
                />
              ) : invoice.footer_message ? (
                <div className="text-sm text-gray-800">{invoice.footer_message}</div>
              ) : (
                <div className="text-sm text-gray-400">—</div>
              )}
            </div>

            {/* Terms & Conditions */}
            <div className="p-4 bg-gray-50 rounded-xl border">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Terms & Conditions
              </div>
              {editMode ? (
                <textarea
                  rows={8}
                  className="w-full border rounded p-2 text-sm resize-y focus:outline-none focus:border-blue-400"
                  value={form.additionalInformation}
                  onChange={(e) => setForm((f) => ({ ...f, additionalInformation: e.target.value }))}
                  placeholder="Enter terms & conditions…"
                />
              ) : (
                <div className="text-sm text-gray-800 whitespace-pre-line">
                  {invoice.additional_information_raw || <span className="text-gray-400">No terms set — edit to add.</span>}
                </div>
              )}
            </div>
          </div>

          {/* Numbers + Discount/Tax */}
          <div className="ml-auto w-full max-w-sm">
            {/* Discount & Tax controls in edit mode */}
            {editMode && (
              <div className="space-y-3 mb-4 text-sm">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.discountEnabled}
                      onChange={(e) => setForm((f) => ({ ...f, discountEnabled: e.target.checked }))}
                    />
                    Apply Discount
                  </label>
                  {form.discountEnabled && (
                    <>
                      <select
                        value={form.discountType}
                        onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                        className="border p-2 rounded"
                      >
                        <option value="PERCENT">Percent (%)</option>
                        <option value="FLAT">Flat ($)</option>
                      </select>
                      <input
                        type="number"
                        value={form.discountValue}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            discountValue: Math.max(0, parseFloat(e.target.value) || 0),
                          }))
                        }
                        className="border p-2 rounded w-24"
                        min="0"
                        step={form.discountType === "PERCENT" ? "1" : "0.01"}
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={form.taxRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxRate: Math.max(0, parseFloat(e.target.value) || 0) }))
                    }
                    className="border p-2 rounded w-24"
                    step="0.01"
                  />
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">
                  {fmtCurrency(editMode ? subtotalEdit : subtotalView)}
                </span>
              </div>

              {(editMode ? form.discountEnabled && discountAmountEdit > 0 : discountEnabledView && Number(discountAmountView) > 0) ? (
                <div className="flex justify-between text-red-600">
                  <span className="inline-flex items-center gap-1">
                    <Percent size={14} />
                    Discount{" "}
                    {editMode
                      ? form.discountType === "PERCENT"
                        ? `(${form.discountValue}%)`
                        : `(Flat ${fmtCurrency(form.discountValue)})`
                      : discountTypeView === "percent"
                      ? `(${discountValueView}%)`
                      : `(Flat ${fmtCurrency(discountValueView)})`}
                  </span>
                  <span className="font-medium">
                    - {fmtCurrency(editMode ? discountAmountEdit : discountAmountView)}
                  </span>
                </div>
              ) : null}

              {(editMode ? taxAmountEdit > 0 : Number(taxView) > 0) ? (
                <div className="flex justify-between">
                  <span>Tax ({(editMode ? Number(form.taxRate) : Number(taxRateView)).toFixed(2)}%)</span>
                  <span className="font-medium">
                    {fmtCurrency(editMode ? taxAmountEdit : taxView)}
                  </span>
                </div>
              ) : null}

              <div className="pt-2 border-t flex justify-between items-center">
                <span className="text-base font-semibold">Total</span>
                <span className="text-xl font-extrabold">
                  {fmtCurrency(editMode ? totalEdit : totalView)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment tracking (INVOICE status only) */}
      {!editMode && !isVoid && !isDraft && <PaymentCard
        invoice={invoice}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        paying={paying}
        setPaying={setPaying}
        setInvoice={setInvoice}
        setDialogType={setDialogType}
        setDialogMessage={setDialogMessage}
        setDialogOpen={setDialogOpen}
      />}

      {/* Reminder card — overdue + unpaid invoices only */}
      {!editMode && !isVoid && !isDraft && <ReminderCard
        invoice={invoice}
        clientEmail={clientUI.email}
        reminderConfig={reminderConfig}
        sendingReminder={sendingReminder}
        setSendingReminder={setSendingReminder}
        setInvoice={setInvoice}
        setDialogType={setDialogType}
        setDialogMessage={setDialogMessage}
        setDialogOpen={setDialogOpen}
      />}

      {/* Danger Zone (hard delete) */}
      {!editMode && (
        <div className="p-4 bg-white rounded-2xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Danger Zone</div>
              <div className="text-xs text-gray-500">
                Deleting is permanent and removes this invoice from your records.
              </div>
            </div>
            <button
              onClick={() => askConfirm("delete")}
              className="px-3 py-2 rounded-lg border text-red-700 hover:bg-red-50"
            >
              Delete Invoice
            </button>
          </div>
        </div>
      )}

      {/* Toast Dialog */}
      {dialogOpen && (
        <DialogBox
          message={dialogMessage}
          type={dialogType}
          onClose={() => setDialogOpen(false)}
        />
      )}

      {/* Confirm Dialog (custom, replaces browser alert) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => (!confirmLoading ? setConfirmOpen(false) : null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border p-5">
            <div className="flex items-center gap-2 mb-2">
              {confirmAction === "void" ? (
                <ShieldAlert className="text-amber-600" size={20} />
              ) : confirmAction === "delete" ? (
                <Trash2 className="text-red-600" size={20} />
              ) : (
                <CopyIcon className="text-gray-700" size={20} />
              )}
              <div className="text-lg font-semibold">
                {confirmAction === "void"
                  ? "Void this invoice?"
                  : confirmAction === "delete"
                  ? "Delete this invoice?"
                  : "Clone & edit this invoice?"}
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              {confirmAction === "void"
                ? "Voiding will mark the invoice as VOID and it cannot be un‑voided."
                : confirmAction === "delete"
                ? "This action is permanent and cannot be undone."
                : "This will create a new invoice (new number) copied from this one, then open it in edit mode."}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                disabled={confirmLoading}
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={confirmLoading}
                onClick={handleConfirm}
                className={`px-3 py-2 rounded-lg text-white ${
                  confirmAction === "void"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : confirmAction === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-gray-800 hover:bg-gray-900"
                }`}
              >
                {confirmLoading
                  ? "Processing…"
                  : confirmAction === "void"
                  ? "Confirm Void"
                  : confirmAction === "delete"
                  ? "Confirm Delete"
                  : "Confirm Clone"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 text-sm text-gray-500">
        <Link to="/invoices" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft size={14} />
          Back to Invoices
        </Link>
      </div>

      {/* Amendment Reason Modal */}
      {amendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAmendModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-amber-600" size={20} />
              <h3 className="text-lg font-semibold">Amend Finalized Invoice</h3>
            </div>
            <p className="text-sm text-gray-500">
              This invoice has already been issued. Any changes will be recorded with your reason for audit purposes.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reason for amendment <span className="text-red-500">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                placeholder="e.g. Corrected tax rate, added missed line item, fixed client address…"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-400"
              />
              {!amendReason.trim() && (
                <p className="text-xs text-red-500 mt-1">A reason is required before editing.</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAmendModalOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={confirmAmend}
                disabled={!amendReason.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40"
              >
                Continue to Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Invoice Modal */}
      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => !sending && setSendOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={18} className="text-emerald-600" />
                <h3 className="text-lg font-semibold">Send Invoice</h3>
              </div>
              <button onClick={() => setSendOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Invoice <span className="font-medium text-gray-700">#{invoice.invoice_no}</span> will be emailed as a PDF attachment.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={sendName}
                  onChange={(e) => setSendName(e.target.value)}
                  placeholder="Client name"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSendOpen(false)}
                disabled={sending}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !sendEmail}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Sending…</>
                ) : (
                  <><Send size={15} /> Send Invoice</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PaymentCard ─────────────────────────────────────────────────── */
function PaymentCard({ invoice, payAmount, setPayAmount, paying, setPaying, setInvoice, setDialogType, setDialogMessage, setDialogOpen }) {
  const amountPaid  = Number(invoice.amount_paid ?? 0);
  const total       = Number(invoice.total ?? 0);
  const remaining   = Math.max(0, total - amountPaid);
  const pct         = total > 0 ? Math.min(100, (amountPaid / total) * 100) : 0;
  const isFullyPaid = amountPaid >= total;

  const [adjustMode, setAdjustMode] = useState(false);
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

  const handlePay = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    setPaying(true);
    try {
      const updated = await recordPayment(invoice.id, amt);
      setInvoice(updated);
      setPayAmount("");
      setDialogType("success");
      setDialogMessage(`Payment of ${fmt(amt)} recorded.`);
      setDialogOpen(true);
    } catch (e) {
      setDialogType("error");
      setDialogMessage(e?.response?.data?.detail || "Failed to record payment.");
      setDialogOpen(true);
    } finally {
      setPaying(false);
    }
  };

  const handleAdjust = async () => {
    const val = parseFloat(adjustValue);
    if (isNaN(val) || val < 0) return;
    setAdjusting(true);
    try {
      const updated = await adjustPayment(invoice.id, val, adjustNote || undefined);
      setInvoice(updated);
      setAdjustMode(false);
      setAdjustValue("");
      setAdjustNote("");
      setDialogType("success");
      setDialogMessage(`Payment corrected to ${fmt(val)}.`);
      setDialogOpen(true);
    } catch (e) {
      setDialogType("error");
      setDialogMessage(e?.response?.data?.detail || "Failed to adjust payment.");
      setDialogOpen(true);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="p-5 bg-white rounded-2xl shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800">Payment</div>
        <div className="flex items-center gap-2">
          {isFullyPaid ? (
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Paid in Full</span>
          ) : amountPaid > 0 ? (
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">Partial</span>
          ) : (
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 ring-1 ring-gray-200">Unpaid</span>
          )}
          <button
            onClick={() => { setAdjustMode((v) => !v); setAdjustValue(String(amountPaid.toFixed(2))); setAdjustNote(""); }}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            title="Correct a payment mistake"
          >
            Correct
          </button>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-sm text-gray-600 mb-4">
        <span>Paid: <span className="font-semibold text-emerald-600">{fmt(amountPaid)}</span></span>
        <span>Remaining: <span className="font-semibold text-gray-800">{fmt(remaining)}</span></span>
        <span>Total: <span className="font-semibold">{fmt(total)}</span></span>
      </div>

      {/* Normal payment entry */}
      {!isFullyPaid && !adjustMode && (
        <div className="flex items-center gap-2">
          <input
            type="number" min="0.01" step="0.01" max={remaining}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder={`Amount (max ${fmt(remaining)})`}
            className="border rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:border-emerald-400"
          />
          <button onClick={handlePay} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition">
            {paying ? "Recording…" : "Record Payment"}
          </button>
          <button onClick={() => setPayAmount(String(remaining.toFixed(2)))}
            className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 text-gray-600">
            Pay Full
          </button>
        </div>
      )}

      {/* Payment correction panel */}
      {adjustMode && (
        <div className="mt-2 p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
          <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <ShieldAlert size={13} /> Correction mode — set the exact amount already paid.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step="0.01"
              value={adjustValue}
              onChange={(e) => setAdjustValue(e.target.value)}
              placeholder="Correct paid amount"
              className="border rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:border-amber-400"
            />
            <input
              type="text"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Reason (optional)"
              className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdjust} disabled={adjusting || adjustValue === ""}
              className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
              {adjusting ? "Saving…" : "Save Correction"}
            </button>
            <button onClick={() => setAdjustMode(false)} className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ReminderCard ────────────────────────────────────────────────── */
function ReminderCard({ invoice, clientEmail, reminderConfig, sendingReminder, setSendingReminder, setInvoice, setDialogType, setDialogMessage, setDialogOpen }) {
  const amountPaid = Number(invoice.amount_paid ?? 0);
  const total      = Number(invoice.total ?? 0);
  if (amountPaid >= total) return null;

  const today   = new Date();
  const dueDate = invoice.due_date ? new Date(invoice.due_date + "T00:00:00") : null;
  if (!dueDate || dueDate >= today) return null;

  const daysOverdue  = Math.floor((today - dueDate) / 86400000);
  const lastSent     = invoice.last_reminder_sent_at ? new Date(invoice.last_reminder_sent_at + "T00:00:00") : null;
  const daysSinceLast = lastSent ? Math.floor((today - lastSent) / 86400000) : null;
  const freqDays     = reminderConfig?.reminder_frequency_days ?? 7;
  const maxCount     = reminderConfig?.reminder_max_count ?? 3;
  const reminderCount = invoice.reminder_count ?? 0;
  const isDue        = daysSinceLast === null || daysSinceLast >= freqDays;
  const isExhausted  = reminderCount >= maxCount;

  const handleRemind = async () => {
    setSendingReminder(true);
    try {
      const updated = await sendReminder(invoice.id);
      setInvoice(updated);
      setDialogType("success");
      setDialogMessage(`Reminder #${updated.reminder_count} sent to ${clientEmail || "client"}.`);
      setDialogOpen(true);
    } catch (e) {
      setDialogType("error");
      setDialogMessage(e?.response?.data?.detail || "Failed to send reminder.");
      setDialogOpen(true);
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="p-5 bg-white rounded-2xl shadow-sm border border-amber-100">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Overdue Reminder
        </div>
        <span className="text-xs text-red-600 font-semibold">{daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Reminders sent</p>
          <p className="font-bold text-lg">{reminderCount}<span className="text-gray-400 font-normal text-sm">/{maxCount}</span></p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Last sent</p>
          <p className="font-semibold">{lastSent ? `${daysSinceLast}d ago` : "Never"}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Next due</p>
          <p className={`font-semibold ${isDue ? "text-red-600" : "text-gray-700"}`}>
            {isExhausted ? "Max reached" : isDue ? "Now" : `${freqDays - daysSinceLast}d`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleRemind} disabled={sendingReminder || isExhausted || !clientEmail}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition">
          {sendingReminder ? "Sending…" : isDue ? "Send Reminder Now" : "Send Anyway"}
        </button>
        {!isDue && !isExhausted && (
          <p className="text-xs text-gray-500">Next reminder in <strong>{freqDays - daysSinceLast} days</strong></p>
        )}
        {isExhausted && (
          <p className="text-xs text-amber-600">Maximum reminders ({maxCount}) reached.</p>
        )}
        {!clientEmail && (
          <p className="text-xs text-red-500">Client has no email — add one in client settings.</p>
        )}
      </div>
    </div>
  );
}
