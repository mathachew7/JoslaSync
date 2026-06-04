import {
  createContext, useContext, useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import API from "../lib/axios";
import { me as apiMe } from "../api/auth";

type User    = { id: number | string; username: string; email: string; role: string };
type Company = { id?: string | number | null; slug?: string | null; db_name?: string | null };

type Ctx = {
  ready:    boolean;
  token:    string | null;
  user:     User    | null;
  company:  Company | null;
  setToken: (t: string | null) => void;
  logout:   () => void;
};

const KEY = "access_token";

const AuthCtx = createContext<Ctx>({
  ready: false, token: null, user: null, company: null,
  setToken: () => {}, logout: () => {},
});

function clearAxios() {
  delete (API.defaults.headers.common as Record<string, unknown>)["Authorization"];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready,    setReady]    = useState(false);
  const [token,    setTokenSt]  = useState<string | null>(null);
  const [user,     setUser]     = useState<User    | null>(null);
  const [company,  setCompany]  = useState<Company | null>(null);

  // Ref lets the auth-changed handler read the latest token without re-registering
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const clearState = useCallback(() => {
    localStorage.removeItem(KEY);
    clearAxios();
    setTokenSt(null);
    setUser(null);
    setCompany(null);
  }, []);

  // Bootstrap on mount: restore from localStorage then validate with /auth/me
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

  // React to auth-changed events fired by the axios interceptor's hardLogout()
  // This is what keeps AuthContext in sync when the interceptor force-clears the session
  useEffect(() => {
    const onAuthChanged = () => {
      const current = localStorage.getItem(KEY);
      if (!current && tokenRef.current) {
        // Token was removed externally (e.g. hardLogout after failed refresh)
        setTokenSt(null);
        setUser(null);
        setCompany(null);
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

    // Fetch identity from server to populate user/company
    apiMe()
      .then(({ user: u, company: c }) => { setUser(u); setCompany(c); })
      .catch(() => clearState());
  }, [clearState]);

  const logout = useCallback(() => {
    clearState();
    document.cookie = "refresh_token=; Max-Age=0; path=/;";
  }, [clearState]);

  const value = useMemo(
    () => ({ ready, token, user, company, setToken, logout }),
    [ready, token, user, company, setToken, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
