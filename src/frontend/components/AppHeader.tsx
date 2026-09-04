"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Search, ChevronRight } from "lucide-react";
import { D, Dot, globalStyles } from "../lib/shared";
import { useAuth } from "../contexts/AuthContext";
import { AccountMenu } from "./AccountMenu";
import { CommandPalette } from "./CommandPalette";
import { useT } from "../lib/i18n";


interface AppHeaderProps {
  candidateName?: string | null;
}

// Nút "Run Sync" đã bỏ. Trang ứng viên tự kiểm tra trạng thái làm giàu và tự
// gọi sync khi mở (candidate-profile/enriched/page.tsx), nên nút chỉ gọi lại
// đúng lệnh đó rồi điều hướng về chính trang đang mở — không có tác dụng gì,
// và trên trang tin tuyển dụng thì còn không có ứng viên nào để sync.
export const AppHeader: React.FC<AppHeaderProps> = ({ candidateName }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useT();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isLanding  = pathname === "/";
  const isEnrichedCandidatePage   = pathname === "/candidate-profile/enriched";

  // ⌘K / Ctrl+K mở bảng lệnh từ bất kỳ đâu trong workspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;

  return (
    <nav style={{
      height: 46, background: D.canvas, borderBottom: `1px solid ${D.line}`,
      display: "flex", alignItems: "center", padding: "0 20px",
      flexShrink: 0, fontFamily: D.font, gap: 0, position: "relative", zIndex: 30,
    }}>
      {/* Logo */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer" }}
        onClick={() => router.push("/")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="0" y="0" width="9" height="9" rx="2" fill={D.blue} />
          <rect x="11" y="0" width="9" height="9" rx="2" fill={D.blue} opacity="0.25" />
          <rect x="0" y="11" width="9" height="9" rx="2" fill={D.blue} opacity="0.25" />
          <rect x="11" y="11" width="9" height="9" rx="2" fill={D.ink} />
        </svg>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: D.ink, letterSpacing: "-0.025em" }}>
          SmartATS
        </span>
        <span style={{
          fontSize: 9, fontWeight: 500, color: D.muted, fontFamily: D.mono,
          padding: "1px 5px", border: `1px solid ${D.line}`, borderRadius: 3, background: D.surface,
        }}>v4.2.1</span>
        <Dot color={D.mint} pulse />
      </div>

      {/* Breadcrumb */}
      {!isLanding ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginLeft: 20,
          fontSize: 11.5, color: D.muted, fontFamily: D.font,
        }}>
          <span
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/")}
          >{t("nav.candidates")}</span>
          <ChevronRight size={11} strokeWidth={2} color={D.dim} />
          <span style={{ color: D.sub, fontWeight: 500 }}>{candidateName || t("nav.candidate")}</span>
          {isEnrichedCandidatePage && (
            <>
              <ChevronRight size={11} strokeWidth={2} color={D.dim} />
              <span style={{ color: D.blue, fontWeight: 500 }}>{t("nav.profileEnrichment")}</span>
            </>
          )}
        </div>
      ) : null}

      {/* Center search: mở bảng lệnh ⌘K (components/CommandPalette) */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={t("nav.searchAria")}
          style={{
            display: "flex", alignItems: "center", gap: 7, width: 280,
            padding: "5px 12px", border: `1px solid ${D.line}`,
            borderRadius: 6, background: D.surface, cursor: "text", fontFamily: D.font,
          }}
        >
          <Search size={11} color={D.dim} strokeWidth={2} />
          <span style={{ flex: 1, textAlign: "left", fontSize: 11.5, color: D.dim }}>
            {t("nav.searchPlaceholder")}
          </span>
          <span style={{
            fontSize: 9.5, color: D.dim, fontFamily: D.mono, background: D.canvas,
            padding: "1px 5px", borderRadius: 3, border: `1px solid ${D.line}`,
          }}>⌘K</span>
        </button>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Admin Dashboard link if user is Admin */}
        {user?.role === "admin" && (
          <button
            type="button"
            onClick={() => router.push("/admin")}
            style={{
              padding: "6px 14px",
              border: `1px solid ${D.blue}`,
              borderRadius: 6,
              background: "rgba(99, 102, 241, 0.08)",
              cursor: "pointer",
              fontSize: 11.5, fontWeight: 600,
              color: D.blue,
              fontFamily: D.font,
              transition: "all 0.2s ease",
            }}
          >
            {t("nav.adminPanel")}
          </button>
        )}

        <div style={{ width: 1, height: 16, background: D.line }} />
 
        {/* Icon-only, so the accessible name has to come from aria-label —
            otherwise a screen reader announces it as just "button". The red
            dot is decoration and is hidden rather than described twice. */}
        <button
          type="button"
          aria-label={t("nav.notifications")}
          title={t("nav.notifications")}
          style={{
            position: "relative", background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", width: 28, height: 28,
            justifyContent: "center", borderRadius: 6,
          }}
        >
          <Bell size={14} color={D.sub} strokeWidth={1.8} aria-hidden="true" />
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: 5, right: 5, width: 5, height: 5,
              borderRadius: "50%", background: D.red, border: `1.5px solid ${D.canvas}`,
            }}
          /></button>
 
        <div style={{ width: 1, height: 16, background: D.line }} />

        {/* Tên, role, công ty, theme, Settings, Logout — gộp vào một menu.
            Role lấy từ JWT; menu "Demo Role" cũ đã bỏ vì nó đổi role bằng
            localStorage, tức là ai cũng tự nâng quyền cho mình được. */}
        <AccountMenu />
      </div>
 
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </nav>
  );
};
