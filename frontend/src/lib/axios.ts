// src/lib/axios.ts
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_JOSLASYNC_API_URL;
if (!BASE_URL) {
  throw new Error("❌ VITE_JOSLASYNC_API_URL is not defined in .env.local");
}

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const ACCESS_KEY = "access_token";

const API = axios.create({
  baseURL: BASE_URL,     // e.g. http://localhost:8000
  withCredentials: true, // needed for /api/auth/refresh cookie
});

// ---- Request: attach bearer ----
API.interceptors.request.use((req: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(ACCESS_KEY) || localStorage.getItem("token");
    if (token) req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// ---- Refresh single-flight machinery ----
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
type QueueItem = {
  resolve: (token: string | null) => void;
  reject: (err: any) => void;
  originalRequest: RetryConfig;
};
const queue: QueueItem[] = [];

function enqueue(originalRequest: RetryConfig) {
  return new Promise<string | null>((resolve, reject) => {
    queue.push({ resolve, reject, originalRequest });
  });
}

function flushQueue(err: any, token: string | null) {
  while (queue.length) {
    const { resolve, reject, originalRequest } = queue.shift()!;
    if (token) {
      originalRequest.headers = { ...(originalRequest.headers || {}), Authorization: `Bearer ${token}` };
      resolve(token);
    } else {
      reject(err);
    }
  }
}

async function doRefresh(): Promise<string | null> {
  try {
    const { data } = await API.post("/api/auth/refresh"); // relies on HttpOnly cookie
    const newToken: string | undefined = data?.access_token;
    if (newToken) {
      localStorage.setItem(ACCESS_KEY, newToken);
      API.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      // notify route guards (if any)
      if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-changed"));
      return newToken;
    }
  } catch (_) {
    // fall through to null (refresh failed)
  }
  return null;
}

function hardLogout() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    delete API.defaults.headers.common["Authorization"];
    // clear cookie client-side (best-effort; server is HttpOnly)
    document.cookie = "refresh_token=; Max-Age=0; path=/;";
    if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-changed"));
  } catch {}
}

// ---- Response: auto-refresh on 401 ----
API.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = (error.config || {}) as RetryConfig;

    // Don’t try to refresh for login/refresh endpoints or already retried calls
    const url = (config.url || "").toString();
    const isAuthEndpoint = url.includes("/api/auth/login") || url.includes("/api/auth/refresh");

    if (status === 401 && !config._retry && !isAuthEndpoint) {
      // queue request until refresh completes
      const waitForToken = enqueue(config);

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = doRefresh();
        const token = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        if (token) {
          flushQueue(null, token);
        } else {
          flushQueue(error, null);
          hardLogout();
        }
      } else {
        // another request is already refreshing; fall through to await
      }

      const token = await waitForToken;
      if (!token) {
        // refresh failed → propagate original error
        return Promise.reject(error);
      }

      // mark as retried and replay
      config._retry = true;
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
      return API.request(config as AxiosRequestConfig);
    }

    return Promise.reject(error);
  }
);

export default API;
