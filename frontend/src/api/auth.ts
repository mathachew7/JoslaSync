// src/api/auth.ts
import API from "../lib/axios";

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: {
    id: number | string;
    username: string;
    email: string;
    is_active: boolean;
    created_at: string;
    role: string;
  };
};

export type MeResponse = {
  user: { id: number | string; username: string; email: string; role: string };
  company: { id?: string | number | null; slug?: string | null; db_name?: string | null };
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await API.post<LoginResponse>("/api/auth/login", { username, password });
  return data;
}

export async function refresh(): Promise<LoginResponse> {
  const { data } = await API.post<LoginResponse>("/api/auth/refresh");
  return data;
}

export async function me(): Promise<MeResponse> {
  const { data } = await API.get<MeResponse>("/api/auth/me");
  return data;
}
