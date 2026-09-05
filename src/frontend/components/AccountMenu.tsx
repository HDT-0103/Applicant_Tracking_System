"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Languages, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { D } from "../lib/shared";
import { useAuth } from "../contexts/AuthContext";
import { useTheme, type ThemePreference } from "../contexts/ThemeContext";
import { LANGS, useLang, useT } from "../lib/i18n";

/**
 * Menu tài khoản ở góc phải header.
 *
 * Thay cho chip tên + nút Logout đứng rời: một chỗ cho danh tính (tên, email,
 * role, công ty), chọn theme, vào Settings và đăng xuất. Đóng khi bấm ra
 * ngoài hoặc nhấn Escape.
 */
const THEME_OPTIONS: { value: ThemePreference; key: string; Icon: typeof Sun }[] = [
  { value: "light", key: "common.theme.light", Icon: Sun },
  { value: "dark", key: "common.theme.dark", Icon: Moon },
  { value: "system", key: "common.theme.system", Icon: Monitor },
];

export function AccountMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const { lang, setLang } = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const subtitle = [user.role ? t(`role.${user.role}`) : "", user.company_name ?? ""]
    .filter(Boolean)
    .join(" · ");

  const item: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: D.ink,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: D.font,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.menu")}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "3px 6px 3px 3px",
          borderRadius: 999,
          border: `1px solid ${open ? D.blue : "transparent"}`,
          background: open ? D.blueSoft : "transparent",
          cursor: "pointer",
          fontFamily: D.font,
        }}
      >
        <div
          style={{
            width: 26, height: 26, borderRadius: "50%", background: D.blue,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9.5, fontWeight: 700, color: "#fff",
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: D.ink, lineHeight: 1.1 }}>{user.name}</span>
          <span style={{ fontSize: 9.5, color: D.dim, lineHeight: 1.2 }}>{subtitle}</span>
        </div>
        <ChevronDown size={12} color={D.dim} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            width: 260,
            zIndex: 80,
            background: D.canvas,
            border: `1px solid ${D.line}`,
            borderRadius: 10,
            boxShadow: D.sh3,
            padding: 6,
          }}
        >
          <div style={{ padding: "8px 10px 10px", borderBottom: `1px solid ${D.lineSoft}`, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: D.ink }}>{user.name}</div>
            <div style={{ fontSize: 11, color: D.muted, marginTop: 1 }}>{user.email}</div>
            {subtitle && <div style={{ fontSize: 10.5, color: D.dim, marginTop: 3 }}>{subtitle}</div>}
          </div>

          <div style={{ padding: "6px 10px 8px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.dim, marginBottom: 6 }}>
              {t("common.theme")}
            </div>
            <div role="radiogroup" aria-label={t("common.theme")} style={{ display: "flex", gap: 4, background: D.surface, padding: 3, borderRadius: 7, border: `1px solid ${D.lineSoft}` }}>
              {THEME_OPTIONS.map(({ value, key, Icon }) => {
                const active = preference === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPreference(value)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      padding: "5px 0",
                      borderRadius: 5,
                      border: "none",
                      background: active ? D.canvas : "transparent",
                      boxShadow: active ? D.sh1 : "none",
                      color: active ? D.ink : D.muted,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: D.font,
                    }}
                  >
                    <Icon size={12} /> {t(key)}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ padding: "2px 10px 8px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.dim, marginBottom: 6 }}>
              {t("common.language")}
            </div>
            <div role="radiogroup" aria-label={t("common.language")} style={{ display: "flex", gap: 4, background: D.surface, padding: 3, borderRadius: 7, border: `1px solid ${D.lineSoft}` }}>
              {LANGS.map(({ value, label }) => {
                const active = lang === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLang(value)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      padding: "5px 0", borderRadius: 5, border: "none",
                      background: active ? D.canvas : "transparent",
                      boxShadow: active ? D.sh1 : "none",
                      color: active ? D.ink : D.muted,
                      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: D.font,
                    }}
                  >
                    {active && <Languages size={12} />} {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            style={item}
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
          >
            <Settings size={14} color={D.sub} /> {t("account.settings")}
          </button>
          <button
            type="button"
            role="menuitem"
            style={{ ...item, color: D.red }}
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut size={14} /> {t("account.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
