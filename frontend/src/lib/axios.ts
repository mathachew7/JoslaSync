import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_JOSLASYNC_API_URL;
if (!BASE_URL) throw new Error("VITE_JOSLASYNC_API_URL is not set");

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const ACCESS_KEY = "access_token";

const API = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // required for HttpOnly refresh cookie
});

// Attach bearer token on every request
API.interceptors.request.use((req: InternalAxiosRequestConfig) => {
  const token = typeof window !== "undefined" ? localStorage.getItem(ACCESS_KEY) : null;
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// --- Single-flight refresh machinery ---
let isRefreshing = false;
type Resolver = { resolve: (t: string) => void; reject: (e: unknown) => void };
const queue: Resolver[] = [];

function enqueue(): Promise<string> {
  return new Promise<string>((resolve, reject) => queue.push({ resolve, reject }));
}

function flushQueue(token: string) {
  queue.splice(0).forEach(({ resolve }) => resolve(token));
}

function rejectQueue(err: unknown) {
  queue.splice(0).forEach(({ reject }) => reject(err));
}

async function doRefresh(): Promise<string | null> {
  try {
    // Create a one-off instance that skips our interceptors to avoid sending
    // the expired access token and avoid triggering another 401 intercept.
    const bare = axios.create({ baseURL: BASE_URL, withCredentials: true });
    const { data } = await bare.post("/api/auth/refresh");
    const newToken: string | undefined = data?.access_token;
    if (newToken) {
      localStorage.setItem(ACCESS_KEY, newToken);
      API.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      window.dispatchEvent(new Event("auth-changed"));
      return newToken;
    }
  } catch {
    // refresh token expired or invalid
  }
  return null;
}

function hardLogout() {
  localStorage.removeItem(ACCESS_KEY);
  delete (API.defaults.headers.common as Record<string, unknown>)["Authorization"];
  document.cookie = "refresh_token=; Max-Age=0; path=/;";
  window.dispatchEvent(new Event("auth-changed"));
}

// Auto-refresh on 401
API.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = (error.config ?? {}) as RetryConfig;
    const url = config.url ?? "";

    // Never retry auth endpoints or already-retried requests
    if (
      status !== 401 ||
      config._retry ||
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request is already refreshing — wait for it
      try {
        const token = await enqueue();
        config._retry = true;
        config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${token}` };
        return API.request(config as AxiosRequestConfig);
      } catch {
        return Promise.reject(error);
      }
    }

    // This request owns the refresh
    isRefreshing = true;
    const newToken = await doRefresh();
    isRefreshing = false;

    if (newToken) {
      flushQueue(newToken);
      config._retry = true;
      config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${newToken}` };
      return API.request(config as AxiosRequestConfig);
    } else {
      rejectQueue(error);
      hardLogout();
      return Promise.reject(error);
    }
  }
);

export default API;
