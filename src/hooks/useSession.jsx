import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, onAuthFailure } from "../services/api";
import { mergeStaffPermissions } from "../utils/departmentPermissions";

const SESSION_USER_KEY = "cms.session.user";

/** Ensure staff workflow perms from department are present (covers stale session after RBAC migrate). */
function enrichSessionUser(user) {
  if (!user || typeof user !== "object") return null;
  const roles = Array.isArray(user.roles)
    ? user.roles
    : user.role
      ? [user.role]
      : [];
  return {
    ...user,
    roles,
    permissions: mergeStaffPermissions(
      roles,
      user.permissions || [],
      user.department,
    ),
  };
}

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return enrichSessionUser(parsed);
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  try {
    if (user) sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_USER_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function isAuthFailure(error) {
  return error?.status === 401 || error?.status === 403;
}

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((next) => {
    const enriched = enrichSessionUser(next);
    setUser(enriched);
    writeStoredUser(enriched);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await authApi.me();
      applyUser(result.user);
      return result.user;
    } catch (error) {
      if (isAuthFailure(error)) {
        applyUser(null);
        return null;
      }
      return readStoredUser();
    }
  }, [applyUser]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await authApi.me();
        if (alive) applyUser(result.user);
      } catch (error) {
        if (alive && isAuthFailure(error)) applyUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyUser]);

  useEffect(() => onAuthFailure(() => applyUser(null)), [applyUser]);

  // Admin อาจเปลี่ยนแผนก/role ขณะที่แท็บยังเปิดอยู่ — ดึง /api/auth/me ใหม่ตอนกลับมาโฟกัสหน้า
  useEffect(() => {
    if (!user?.id) return undefined;

    let busy = false;
    let lastAt = 0;
    const MIN_INTERVAL_MS = 15_000;

    const refreshIfVisible = () => {
      if (document.visibilityState === "hidden") return;
      if (busy) return;
      const now = Date.now();
      if (now - lastAt < MIN_INTERVAL_MS) return;
      busy = true;
      lastAt = now;
      refresh().finally(() => {
        busy = false;
      });
    };

    const onFocus = () => refreshIfVisible();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshIfVisible();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, user?.id]);

  const login = useCallback(async (payload) => {
    const result = await authApi.login(payload);
    applyUser(result.user);
    return result.user;
  }, [applyUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      applyUser(null);
    }
  }, [applyUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refresh,
    }),
    [user, loading, login, logout, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
