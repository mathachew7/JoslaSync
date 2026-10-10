// src/api/health.ts
import API from "../lib/axios";

export type HealthComponent = {
  name: string;
  status: "ok" | "down";
};

export type HealthResponse = {
  status: "ok" | "degraded";
  components: HealthComponent[];
  time: string;
  started_at: string;
  uptime_seconds: number;
  version: string;
};

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await API.get<HealthResponse>("/api/health");
  return data;
}
