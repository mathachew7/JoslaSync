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

export async function listTenants(): Promise<Tenant[]> {
  const { data } = await API.get<Tenant[]>("/api/admin/tenants");
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

export async function updateTenantStatus(id: number, status: "active" | "suspended"): Promise<Tenant> {
  const { data } = await API.put<Tenant>(`/api/admin/tenants/${id}/status`, { status });
  return data;
}

export async function resetUserPassword(userId: number): Promise<{ user: TenantUser; temp_password: string }> {
  const { data } = await API.post(`/api/admin/users/${userId}/reset-password`);
  return data;
}

export async function setPassword(newPassword: string): Promise<void> {
  await API.post("/api/auth/set-password", { new_password: newPassword });
}
