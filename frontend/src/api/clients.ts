// src/api/clients.ts
import API from "../lib/axios";

export type Client = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: "Active" | "Deactivated" | "Blacklisted";
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type ClientListOut = {
  data: Client[];
  meta: { page: number; page_size: number; total: number };
};

export async function listClients(params: {
  q?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<ClientListOut> {
  const { data } = await API.get("/api/clients", { params });
  return data;
}

export async function getClient(client_id: string): Promise<Client> {
  const { data } = await API.get(`/api/clients/${client_id}`);
  return data;
}

export async function createClient(payload: Partial<Client>): Promise<Client> {
  const { data } = await API.post("/api/clients", payload);
  return data;
}

export async function updateClient(client_id: string, payload: Partial<Client>): Promise<Client> {
  const { data } = await API.put(`/api/clients/${client_id}`, payload);
  return data;
}

export async function deleteClient(client_id: string): Promise<void> {
  await API.delete(`/api/clients/${client_id}`);
}
