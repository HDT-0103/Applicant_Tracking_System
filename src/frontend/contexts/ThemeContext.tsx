"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicRoute } from "../lib/routes";

/**
 * Chế độ sáng / tối.
 *
 * Toàn bộ màu của app là biến CSS (globals.css), nên đổi theme chỉ là đặt
 * `data-theme` lên <html>. Lựa chọn lưu trong localStorage của trình duyệt —
 * là tiện nghi cá nhân, không cần backend.
 *
 * Trang công khai (đăng nhập, đăng ký, careers) LUÔN sáng: ứng viên không có
 * tài khoản, không có nút đổi, và các trang đó dùng bảng màu riêng (authTheme)
 * chưa có bản tối.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "smartats_theme";

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/** Theme thật sự áp lên trang này — trang công khai luôn sáng. */
export function themeForPath(
  pref: ThemePreference,
  systemDark: boolean,
  pathname: string | null | undefined,
): ResolvedTheme {
  if (isPublicRoute(pathname)) return "light";
  return resolveTheme(pref, systemDark);
}

export function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
  } catch {
    return "system";
  }
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setPreferenceState(readStoredTheme());
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const resolved = themeForPath(preference, systemDark, pathname);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* private mode: vẫn đổi được cho phiên này */
    }
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
};
