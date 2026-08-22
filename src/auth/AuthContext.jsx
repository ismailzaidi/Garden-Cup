import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { apiRequest, hasApi, onUnauthorized } from "../lib/apiClient.js";
import { setSessionActive } from "../lib/syncEngine.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const cloud = hasApi();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!cloud); // local mode is "ready" instantly, nothing to check

  useEffect(() => {
    if (!cloud) return;
    (async () => {
      try {
        const res = await apiRequest("/auth/me");
        setUser(res.user);
        setSessionActive(true);
      } catch {
        setSessionActive(false);
      } finally {
        setReady(true);
      }
    })();
  }, [cloud]);

  useEffect(() => {
    if (!cloud) return undefined;
    return onUnauthorized(() => setUser(null));
  }, [cloud]);

  const login = useCallback(async ({ email, password }) => {
    const res = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
    setUser(res.user);
    setSessionActive(true);
    return res.user;
  }, []);

  const register = useCallback(async ({ email, password, displayName, inviteCode }) => {
    const res = await apiRequest("/auth/register", {
      method: "POST",
      body: { email, password, displayName, inviteCode },
    });
    setUser(res.user);
    setSessionActive(true);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setSessionActive(false);
    try { await apiRequest("/auth/logout", { method: "POST" }); } catch { /* best-effort */ }
  }, []);

  const value = useMemo(() => ({
    mode: cloud ? "cloud" : "local",
    user,
    ready,
    login,
    register,
    logout,
  }), [cloud, user, ready, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
