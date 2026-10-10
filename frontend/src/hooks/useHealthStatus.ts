// src/hooks/useHealthStatus.ts
import { useEffect, useRef, useState } from "react";
import { getHealth } from "../api/health";

const POLL_MS = 10 * 60 * 1000; // refresh every 10 min while the page is open

export type HealthState = {
  status: "checking" | "ok" | "down";
  lastChecked: Date | null;
  uptimeSeconds: number | null;
  version: string | null;
};

export function useHealthStatus(): HealthState {
  const [state, setState] = useState<HealthState>({
    status: "checking",
    lastChecked: null,
    uptimeSeconds: null,
    version: null,
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const check = async () => {
      try {
        const data = await getHealth();
        if (!aliveRef.current) return;
        setState({
          status: "ok",
          lastChecked: new Date(),
          uptimeSeconds: data.uptime_seconds,
          version: data.version,
        });
      } catch {
        if (!aliveRef.current) return;
        setState((s) => ({ ...s, status: "down", lastChecked: new Date() }));
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
