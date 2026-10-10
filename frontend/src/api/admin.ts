import API from "../lib/axios";

export type TenantUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
};

export type Tenant = {
  id: number;
  company_name: string;
  db_name: string;
  status: string;
  created_at: string;
  users: TenantUser[];
};

export type TenantCreate = {
  company_name: string;
  username_or_email: string;
  temp_password: string;
};

export type AdminStats = {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  total_users: number;
  tenants_this_month: number;
  monthly_growth: { month: string; year: number; tenants: number }[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await API.get<AdminStats>("/api/admin/stats");
  return data;
}

export async function listTenants(includeArchived = false): Promise<Tenant[]> {
  const { data } = await API.get<Tenant[]>("/api/admin/tenants", {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

export async function createTenant(body: TenantCreate): Promise<Tenant> {
  const { data } = await API.post<Tenant>("/api/admin/tenants", body);
  return data;
}

export async function getTenant(id: number): Promise<Tenant> {
  const { data } = await API.get<Tenant>(`/api/admin/tenants/${id}`);
  return data;
}

export async function updateTenantStatus(id: number, status: "active" | "suspended" | "archived"): Promise<Tenant> {
  const { data } = await API.put<Tenant>(`/api/admin/tenants/${id}/status`, { status });
  return data;
}

export async function updateTenantName(id: number, companyName: string): Promise<Tenant> {
  const { data } = await API.put<Tenant>(`/api/admin/tenants/${id}`, { company_name: companyName });
  return data;
}

export async function addTenantUser(id: number, usernameOrEmail: string, tempPassword: string): Promise<Tenant> {
  const { data } = await API.post<Tenant>(`/api/admin/tenants/${id}/users`, {
    username_or_email: usernameOrEmail,
    temp_password: tempPassword,
  });
  return data;
}

export async function resetUserPassword(userId: number): Promise<{ user: TenantUser; temp_password: string }> {
  const { data } = await API.post(`/api/admin/users/${userId}/reset-password`);
  return data;
}

export async function setPassword(newPassword: string): Promise<void> {
  await API.post("/api/auth/set-password", { new_password: newPassword });
}

export type TenantFeatures = {
  draft_invoices: boolean;
  recurring_invoices: boolean;
  multi_user: boolean;
  email_reminders: boolean;
};

export async function getTenantFeatures(companyId: number): Promise<TenantFeatures> {
  const { data } = await API.get<TenantFeatures>(`/api/admin/tenants/${companyId}/features`);
  return data;
}

export async function updateTenantFeature(
  companyId: number,
  featureKey: string,
  enabled: boolean
): Promise<TenantFeatures> {
  const { data } = await API.put<TenantFeatures>(`/api/admin/tenants/${companyId}/features`, {
    feature_key: featureKey,
    enabled,
  });
  return data;
}
