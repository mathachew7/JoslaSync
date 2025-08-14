// src/lib/auth.ts
import API from "./axios";

const KEY = "access_token";
const EVENT = "auth-changed";

export const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(KEY);
};

export const setAuth = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, token);
  API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  window.dispatchEvent(new Event(EVENT));
};

export const logout = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  delete (API.defaults.headers.common as any)["Authorization"];
  // If refresh is HttpOnly (recommended), server controls expiry; this is a best-effort client clear:
  document.cookie = "refresh_token=; Max-Age=0; path=/;";
  window.dispatchEvent(new Event(EVENT));
};

export const initAuth = (): void => {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem(KEY);
  if (token) API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};
