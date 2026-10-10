// src/api/company.ts
import API from "../lib/axios";

export type CompanyProfile = {
  company_name: string;
  company_email: string;
  company_mobile: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  tax_rate: number;
  logo_url?: string | null;
  status?: string;
  db_name?: string | null;
  updated_at?: string;
};

export type CompanyProfileUpdate = Partial<CompanyProfile> & {
  // file field name must be `logoFile` to match backend
  logoFile?: File | null;
};

const toFormData = (obj: Record<string, any>): FormData => {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "logoFile" && v instanceof File) {
      fd.append("logoFile", v);
    } else {
      fd.append(k, String(v));
    }
  });
  return fd;
};

export const getCompanyProfile = async (): Promise<CompanyProfile> => {
  const { data } = await API.get<CompanyProfile>("/api/company-profile");
  return data;
};

export const updateCompanyProfile = async (
  payload: CompanyProfileUpdate | FormData
): Promise<CompanyProfile> => {
  const body = payload instanceof FormData ? payload : toFormData(payload);
  const { data } = await API.put<CompanyProfile>("/api/company-profile", body);
  return data;
};

export const registerCompanyProfile = async (formData: FormData) => {
  const { data } = await API.post<CompanyProfile>("/api/company-profile", formData);
  return data;
};

export type ReminderSettings = {
  reminder_enabled: boolean;
  reminder_frequency_days: number;
  reminder_max_count: number;
};

export const getCompanySettings = async (): Promise<ReminderSettings & Record<string, unknown>> => {
  const { data } = await API.get("/api/company/settings");
  return data;
};

export const updateReminderSettings = async (settings: ReminderSettings): Promise<void> => {
  const fd = new FormData();
  fd.append("reminder_enabled", String(settings.reminder_enabled));
  fd.append("reminder_frequency_days", String(settings.reminder_frequency_days));
  fd.append("reminder_max_count", String(settings.reminder_max_count));
  await API.put("/api/company/settings", fd);
};

export type InvoiceSettings = {
  invoice_prefix: string;
  default_tax_rate: number;
  currency_code: string;
  terms_template: string;
};

export const updateInvoiceSettings = async (settings: Partial<InvoiceSettings>): Promise<void> => {
  const fd = new FormData();
  if (settings.invoice_prefix !== undefined) fd.append("invoice_prefix", settings.invoice_prefix);
  if (settings.default_tax_rate !== undefined) fd.append("default_tax_rate", String(settings.default_tax_rate));
  if (settings.currency_code !== undefined) fd.append("currency_code", settings.currency_code);
  if (settings.terms_template !== undefined) fd.append("terms_template", settings.terms_template);
  await API.put("/api/company/settings", fd);
};

export const COMPANY_TYPES = [
  { value: "IT_SOFTWARE", label: "IT / Software & Tech Services" },
  { value: "CONSULTING", label: "Consulting / Professional Services" },
  { value: "CREATIVE_MARKETING", label: "Creative / Design & Marketing" },
  { value: "RETAIL_ECOMMERCE", label: "Retail / E-commerce (Goods)" },
  { value: "CONSTRUCTION_TRADES", label: "Construction / Contracting / Trades" },
  { value: "GENERAL_OTHER", label: "General / Other Services" },
] as const;

export const updateCompanyType = async (
  companyType: string,
  legalName?: string
): Promise<{ company_type: string; terms_template: string } & Record<string, unknown>> => {
  const fd = new FormData();
  fd.append("company_type", companyType);
  if (legalName) fd.append("legal_name", legalName);
  const { data } = await API.put("/api/company/settings", fd);
  return data;
};
