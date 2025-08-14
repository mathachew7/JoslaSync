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

export const getCompanyProfile = async (): Promise<CompanyProfile> => {
  const { data } = await API.get<CompanyProfile>("/api/company-profile");
  return data;
};

export const updateCompanyProfile = async (
  payload: Partial<CompanyProfile> | FormData
): Promise<CompanyProfile> => {
  if (payload instanceof FormData) {
    const { data } = await API.put<CompanyProfile>("/api/company-profile", payload);
    return data;
  }
  // convert partial object to multipart form (backend expects FormData)
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  });
  const { data } = await API.put<CompanyProfile>("/api/company-profile", fd);
  return data;
};

export const registerCompanyProfile = (formData: FormData) =>
  API.post<CompanyProfile>("/api/company-profile", formData);
