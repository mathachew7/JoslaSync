// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import API from "../lib/axios";
import { me as apiMe } from "../api/auth";

type User = { id: number | string; username: string; email: string; role: string };
type Company = { id?: string | number | null; slug?: string | null; db_name?: string | null };

type Ctx = {
  ready: boolean;
  token: string | null;
  user: User | null;
  company: Company | null;
  setToken: (t: string | null) => void;
  logout: () => void;
};

const KEY = "access_token";

const AuthCtx = createContext<Ctx>({
  ready: false,
  token: null,
  user: null,
  company: null,
  setToken: () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  // Bootstrap from localStorage, then fetch /auth/me
  useEffect(() => {
    const t = localStorage.getItem(KEY);
    if (t) {
      API.defaults.headers.common["Authorization"] = `Bearer ${t}`;
      setTokenState(t);
      (async () => {
        try {
          const data = await apiMe();
          setUser(data.user);
          setCompany(data.company);
        } catch {
          // invalid/expired token: clear
          localStorage.removeItem(KEY);
          delete API.defaults.headers.common["Authorization"];
          setTokenState(null);
          setUser(null);
          setCompany(null);
        } finally {
          setReady(true);
        }
      })();
    } else {
      setReady(true);
    }
  }, []);

  const setToken = useCallback((t: string | null) => {
    if (t) {
      localStorage.setItem(KEY, t);
      API.defaults.headers.common["Authorization"] = `Bearer ${t}`;
      setTokenState(t);

      // Immediately load identity + tenant context
      (async () => {
        try {
          const data = await apiMe();
          setUser(data.user);
          setCompany(data.company);
        } catch {
          // bad/expired token — clear everything
          localStorage.removeItem(KEY);
          delete API.defaults.headers.common["Authorization"];
          setTokenState(null);
          setUser(null);
          setCompany(null);
        }
        if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-changed"));
      })();
    } else {
      localStorage.removeItem(KEY);
      delete API.defaults.headers.common["Authorization"];
      setTokenState(null);
      setUser(null);
      setCompany(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-changed"));
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    // best-effort client clear; server cookie is HttpOnly
    document.cookie = "refresh_token=; Max-Age=0; path=/;";
  }, [setToken]);

  const value = useMemo(
    () => ({ ready, token, user, company, setToken, logout }),
    [ready, token, user, company, setToken, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
