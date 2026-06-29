import {
  createContext, useContext, useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import API, { setViewingTenantHeader, clearViewingTenantHeader } from "../lib/axios";
import { me as apiMe } from "../api/auth";

type User    = { id: number | string; username: string; email: string; role: string; must_change_password?: boolean };
type Company = { id?: string | number | null; slug?: string | null; db_name?: string | null; company_name?: string | null };
export type ViewingTenant = { id: number; company_name: string; db_name: string } | null;

type Ctx = {
  ready:             boolean;
  token:             string | null;
  user:              User    | null;
  company:           Company | null;
  viewingTenant:     ViewingTenant;
  setToken:          (t: string | null) => void;
  logout:            () => void;
  refreshUser:       () => Promise<void>;
  setViewingTenant:  (t: ViewingTenant) => void;
};

const KEY = "access_token";

const AuthCtx = createContext<Ctx>({
  ready: false, token: null, user: null, company: null, viewingTenant: null,
  setToken: () => {}, logout: () => {}, refreshUser: async () => {}, setViewingTenant: () => {},
});

function clearAxios() {
  delete (API.defaults.headers.common as Record<string, unknown>)["Authorization"];
  clearViewingTenantHeader();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready,          setReady]          = useState(false);
  const [token,          setTokenSt]        = useState<string | null>(null);
  const [user,           setUser]           = useState<User    | null>(null);
  const [company,        setCompany]        = useState<Company | null>(null);
  const [viewingTenant,  setViewingTenantSt] = useState<ViewingTenant>(null);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const clearState = useCallback(() => {
    localStorage.removeItem(KEY);
    clearAxios();
    setTokenSt(null);
    setUser(null);
    setCompany(null);
    setViewingTenantSt(null);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (!stored) { setReady(true); return; }

    API.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
    setTokenSt(stored);

    apiMe()
      .then(({ user: u, company: c }) => { setUser(u); setCompany(c); })
      .catch(() => clearState())
      .finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onAuthChanged = () => {
      const current = localStorage.getItem(KEY);
      if (!current && tokenRef.current) {
        setTokenSt(null);
        setUser(null);
        setCompany(null);
        setViewingTenantSt(null);
      }
    };
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, []);

  const setToken = useCallback((t: string | null) => {
    if (!t) { clearState(); return; }
    localStorage.setItem(KEY, t);
    API.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    setTokenSt(t);
    apiMe()
      .then(({ user: u, company: c }) => { setUser(u); setCompany(c); })
      .catch(() => clearState());
  }, [clearState]);

  const logout = useCallback(() => {
    clearState();
    document.cookie = "refresh_token=; Max-Age=0; path=/;";
  }, [clearState]);

  const refreshUser = useCallback(async () => {
    try {
      const { user: u, company: c } = await apiMe();
      setUser(u);
      setCompany(c);
    } catch {
      clearState();
    }
  }, [clearState]);

  const setViewingTenant = useCallback((t: ViewingTenant) => {
    setViewingTenantSt(t);
    if (t) {
      setViewingTenantHeader(t.db_name);
    } else {
      clearViewingTenantHeader();
    }
  }, []);

  const value = useMemo(
    () => ({ ready, token, user, company, viewingTenant, setToken, logout, refreshUser, setViewingTenant }),
    [ready, token, user, company, viewingTenant, setToken, logout, refreshUser, setViewingTenant],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
