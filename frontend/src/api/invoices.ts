// src/api/invoices.ts
import api from "../lib/axios";

export type UUID = string;
export type DiscountType = "PERCENT" | "FLAT";

// --- clone overrides to match backend /clone endpoint ---
export type CloneOverrides = {
  invoice_date?: string;           // "YYYY-MM-DD"
  due_date?: string;               // "YYYY-MM-DD"
  status?: "DRAFT" | "INVOICE";
};

// --- payload & models (company_id is INT now) ---

export interface InvoiceItemCreate {
  sno: number;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface InvoiceCreate {
  client_id: UUID;
  /** INT to match backend company_profile.id */
  company_id?: number;
  invoice_date: string;          // "YYYY-MM-DD"
  due_date?: string;             // "YYYY-MM-DD"
  place_of_supply?: string;      // e.g., "MO"
  invoice_title?: string | null; // blank -> omit/null
  discount_enabled: boolean;
  discount_type?: DiscountType;  // only if discount_enabled
  discount_value: number;        // 0..100 for PERCENT, >=0 for FLAT
  tax_rate: number;              // 0..100
  footer_message?: string;
  additional_information_raw?: string;
  items: InvoiceItemCreate[];
  created_by_user_id?: UUID;
  created_by_name?: string;
  edit_note?: string;
}

export interface InvoiceItemRead {
  id: number;
  sno: number;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface InvoiceRead {
  id: UUID;
  invoice_no: string;
  status: "INVOICE" | "VOID" | "DRAFT";
  amount_paid: number;

  client_id: UUID;
  /** INT to match backend company_profile.id */
  company_id?: number | null;

  created_by_user_id?: UUID | null;
  created_by_name?: string | null;

  invoice_date: string;     // "YYYY-MM-DD"
  due_date?: string | null; // "YYYY-MM-DD"
  place_of_supply?: string | null;
  invoice_title?: string | null;

  discount_enabled: boolean;
  discount_type?: DiscountType | null;
  discount_value: number;
  tax_rate: number;

  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;

  footer_message?: string | null;
  additional_information_raw?: string | null;

  created_at: string;
  updated_at: string;

  // Optional expanded relations:
  company?: {
    company_name?: string;
    company_email?: string;
    company_mobile?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    logo_url?: string;
    full_name?: string;
  } | null;

  client?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    shipping_address1?: string;
    shipping_address2?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_zip?: string;
    shipping_country?: string;
  } | null;

  items: InvoiceItemRead[];
}

/** Common paginated response shape */
export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  pages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Dashboard/analytics DTOs */
export interface InvoiceStats {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  draft: number;
  total_invoiced: number;
  total_collected: number;
  outstanding_amount: number;
  overdue_amount: number;
}

export interface MonthlyTotalsRow {
  month: string;         // "Jan", "Feb", ...
  Paid: number;
  Outstanding: number;
  Overdue: number;
}

export interface TopClientRow {
  client: string;
  Paid: number;
  Outstanding: number;
  Overdue: number;
  Total: number;
}

// --- REST calls ---

export function createInvoice(payload: InvoiceCreate) {
  return api.post<InvoiceRead>("/api/invoices", payload).then(r => r.data);
}

/** Fetch a single invoice by ID. Pass expand flags if your backend supports it. */
export function getInvoiceById(
  id: UUID,
  opts?: { expand?: Array<"company" | "client" | "items"> }
) {
  const params: Record<string, string> = {};
  if (opts?.expand?.length) params.expand = opts.expand.join(",");
  return api.get<InvoiceRead>(`/api/invoices/${id}`, { params }).then(r => r.data);
}

/** Back-compat alias (so old imports keep working) */
export const getInvoice = getInvoiceById;

/** Paginated list with filters/search/sort */
export function listInvoices(params?: {
  client_id?: UUID;
  status?: "INVOICE" | "VOID" | "DRAFT";
  page?: number;
  page_size?: number;
  /** free-text search across invoice_no, client name, etc. */
  q?: string;
  /** ISO date range filter on invoice_date */
  date_from?: string;    // "YYYY-MM-DD"
  date_to?: string;      // "YYYY-MM-DD"
  /** sorting */
  sort?: "invoice_date" | "created_at" | "total" | "invoice_no";
  order?: "asc" | "desc";
}) {
  return api.get<Paginated<InvoiceRead>>("/api/invoices", { params }).then(r => r.data);
}

/** Promote a DRAFT invoice to INVOICE status */
export function issueInvoice(id: UUID) {
  return api.post<InvoiceRead>(`/api/invoices/${id}/issue`).then(r => r.data);
}

/** Void an invoice (immutability policy) */
export function voidInvoice(id: UUID) {
  return api.post<InvoiceRead>(`/api/invoices/${id}/void`).then(r => r.data);
}

/** Hard delete (only if allowed by backend policy) */
export function deleteInvoice(id: UUID) {
  return api.delete<void>(`/api/invoices/${id}`).then(r => r.data);
}

/**
 * Clone an existing invoice into a NEW persisted invoice.
 * Backend returns the created InvoiceRead (201).
 * Optional overrides let you set status/dates on creation.
 */
export function cloneInvoice(id: UUID, overrides?: CloneOverrides) {
  return api.post<InvoiceRead>(`/api/invoices/${id}/clone`, overrides ?? {}).then(r => r.data);
}

export function updateInvoice(id: UUID, payload: InvoiceCreate) {
  return api.put<InvoiceRead>(`/api/invoices/${id}`, payload).then(r => r.data);
}

export function recordPayment(id: UUID, amount: number, note?: string) {
  return api.post<InvoiceRead>(`/api/invoices/${id}/pay`, { amount, note }).then(r => r.data);
}

export function adjustPayment(id: UUID, amount_paid: number, note?: string) {
  return api.put<InvoiceRead>(`/api/invoices/${id}/payment`, { amount_paid, note }).then(r => r.data);
}

export function sendReminder(id: UUID) {
  return api.post<InvoiceRead>(`/api/invoices/${id}/remind`).then(r => r.data);
}

export function sendInvoiceEmail(id: UUID, payload: {
  to_email: string;
  to_name: string;
  pdf_base64: string;
  pdf_filename: string;
}) {
  return api.post<{ message: string }>(`/api/invoices/${id}/send`, payload).then(r => r.data);
}


// ----- Analytics -----

export function getInvoiceStats() {
  return api.get<InvoiceStats>("/api/invoices/stats").then(r => r.data);
}

export function getMonthlyTotals(params: { year_from: number; year_to: number }) {
  return api
    .get<MonthlyTotalsRow[]>("/api/invoices/analytics/monthly", { params })
    .then(r => r.data);
}

export function getTopClients(params: { limit?: number; year_from?: number; year_to?: number }) {
  return api
    .get<TopClientRow[]>("/api/invoices/analytics/top-clients", { params })
    .then(r => r.data);
}

// Optional (only if you add a payload endpoint later):
export type FrozenPayload = Record<string, unknown>;
export function getInvoicePayload(id: UUID) {
  return api.get<FrozenPayload>(`/api/invoices/${id}/payload`).then(r => r.data);
}
