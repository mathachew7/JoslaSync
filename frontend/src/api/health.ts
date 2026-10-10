// src/api/health.ts
import API from "../lib/axios";

export type HealthResponse = {
  status: "ok";
  time: string;
  uptime_seconds: number;
  version: string;
};

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await API.get<HealthResponse>("/api/health");
  return data;
}
