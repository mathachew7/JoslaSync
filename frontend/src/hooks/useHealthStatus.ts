// src/hooks/useHealthStatus.ts
import { useEffect, useRef, useState } from "react";
import { getHealth, HealthComponent } from "../api/health";

const POLL_MS = 10 * 60 * 1000; // refresh every 10 min while the page is open

export type HealthState = {
  status: "checking" | "ok" | "degraded" | "down";
  components: HealthComponent[];
  lastChecked: Date | null;
  serverTime: string | null;
  startedAt: string | null;
  uptimeSeconds: number | null;
  version: string | null;
  responseMs: number | null;
};

export function useHealthStatus(): HealthState {
  const [state, setState] = useState<HealthState>({
    status: "checking",
    components: [],
    lastChecked: null,
    serverTime: null,
    startedAt: null,
    uptimeSeconds: null,
    version: null,
    responseMs: null,
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const check = async () => {
      const start = performance.now();
      try {
        const data = await getHealth();
        if (!aliveRef.current) return;
        setState({
          status: data.status,
          components: data.components || [],
          lastChecked: new Date(),
          serverTime: data.time,
          startedAt: data.started_at,
          uptimeSeconds: data.uptime_seconds,
          version: data.version,
          responseMs: Math.round(performance.now() - start),
        });
      } catch {
        if (!aliveRef.current) return;
        setState((s) => ({ ...s, status: "down", lastChecked: new Date(), responseMs: null }));
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}
