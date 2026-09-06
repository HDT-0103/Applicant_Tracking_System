"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Calendar, Link2, AlertCircle, X, Key, CheckCircle2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  checkCalendarStatus,
  getGoogleAuthUrl,
  updateCalendarApiKey,
} from "../services/schedulingService";
import { D, tint } from "../lib/shared";
import { useT } from "../lib/i18n";

export function RequireCalendarModal() {
  const pathname = usePathname();
  const t = useT();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const role = (user?.role || "").toLowerCase();
  // Áp dụng đúng và đầy đủ cho cả 2 role: HR và Tech Lead
  const isHr = role === "hr";
  const isTechLead = role === "tech_lead" || role === "techlead";
  const isEligibleRole = isHr || isTechLead || role === "interviewer";
  const requiresCalendar = isAuthenticated && isEligibleRole;

  // Kiểm tra trạng thái calendar mỗi khi chuyển trang hoặc đổi user
  useEffect(() => {
    if (!requiresCalendar || authLoading) return;

    // Đang trong tiến trình OAuth redirect có mã ?code= trên URL thì không kiểm tra
    // để tránh race condition trước khi mã code được exchange thành công
    const hasCode =
      typeof window !== "undefined" &&
      Boolean(new URLSearchParams(window.location.search).get("code"));

    if (hasCode) return;

    let mounted = true;
    checkCalendarStatus()
      .then((res) => {
        if (mounted) setConnected(res.connected);
      })
      .catch(() => {
        // Không tự động gán false khi gặp lỗi mạng/chưa sẵn sàng để tránh hiện pop-up nhầm
        if (mounted) setConnected(null);
      });

    return () => {
      mounted = false;
    };
  }, [requiresCalendar, authLoading, user?.id, pathname]);

  // Lắng nghe sự kiện kết nối calendar thành công từ trang schedule hoặc modal
  useEffect(() => {
    const handleStatusUpdate = (e: any) => {
      if (typeof e?.detail?.connected === "boolean") {
        setConnected(e.detail.connected);
      } else {
        checkCalendarStatus()
          .then((res) => setConnected(res.connected))
          .catch(() => setConnected(null));
      }
    };
    window.addEventListener("calendar-status-updated", handleStatusUpdate);
    return () => {
      window.removeEventListener("calendar-status-updated", handleStatusUpdate);
    };
  }, []);

  // ─── KIỂM TRA ĐIỀU KIỆN TRƯỚC KHI HIỆN POP-UP ────────────────────────────────
  // 1. Phải là role HR hoặc Tech Lead đã xác thực
  if (!isAuthenticated || !isEligibleRole || authLoading) {
    return null;
  }

  // 2. Nếu đã có Google Calendar rồi (connected === true), thì thôi KHÔNG HIỆN NỮA
  if (connected === true) {
    return null;
  }

  // 3. Chỉ hiện pop up khi và chỉ khi phát hiện người này chưa cung cấp Google Calendar (connected === false)
  if (connected !== false) {
    return null;
  }

  const handleConnectOAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || t("calendar.errInit"));
      setLoading(false);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setError("Vui lòng nhập Google Calendar API Key");
      return;
    }
    setSavingKey(true);
    setError(null);
    try {
      await updateCalendarApiKey(apiKeyInput.trim());
      setSuccess("Đã lưu Google Calendar API Key thành công!");
      setConnected(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("calendar-status-updated", { detail: { connected: true } })
        );
      }
    } catch (err: any) {
      setError(err?.message || "Không thể lưu API Key. Vui lòng thử lại.");
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <>
      {/* 1. NÚT NỔI Ở GÓC PHẢI MÀN HÌNH (chỉ hiển thị khi modal đã bị đóng và chưa kết nối) */}
      {isDismissed && (
        <div
          onClick={() => setIsDismissed(false)}
        style={{
          position: "fixed",
          bottom: "84px",
          right: "24px",
          background: D.canvas,
          border: `1.5px solid ${isDismissed ? D.amber : D.line}`,
          borderRadius: "24px",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)",
          cursor: "pointer",
          zIndex: 9999,
          animation: "modalFadeIn 0.2s ease-out",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.03)";
          e.currentTarget.style.borderColor = D.blue;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = isDismissed ? D.amber : D.line;
        }}
        title="Google Calendar API Key (Bấm để thiết lập)"
      >
        <Key size={15} color={D.blue} strokeWidth={2.2} />
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: D.ink }}>
          Google Calendar API Key
        </span>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: D.amber,
            display: "inline-block",
          }}
          title="Chưa kết nối calendar"
        />
      </div>
      )}

      {/* 2. POP-UP MODAL (chỉ hiển thị khi và chỉ khi chưa cung cấp Google Calendar và chưa bị đóng) */}
      {!isDismissed && connected === false && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              background: D.canvas,
              borderRadius: "16px",
              border: `1px solid ${D.line}`,
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
              padding: "30px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              animation: "modalFadeIn 0.2s ease-out",
            }}
          >
            {/* Nút X ở góc trên bên phải */}
            <button
              onClick={() => setIsDismissed(true)}
              type="button"
              aria-label="Đóng"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: D.muted,
                padding: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = D.surface;
                e.currentTarget.style.color = D.ink;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = D.muted;
              }}
            >
              <X size={20} />
            </button>

            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: `${tint("blue", "15")}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Calendar size={28} color={D.blue} strokeWidth={1.75} />
            </div>

            <h2
              style={{
                fontSize: "19px",
                fontWeight: 700,
                color: D.ink,
                marginBottom: "8px",
              }}
            >
              {t("calendar.title")}
            </h2>

            <p
              style={{
                fontSize: "13px",
                color: D.muted,
                lineHeight: 1.5,
                marginBottom: "20px",
              }}
            >
              {t("calendar.welcome")}{" "}
              <strong>
                {user?.name || (isTechLead ? t("role.tech_lead") : t("role.hr"))}
              </strong>
              . {t("calendar.body")}
            </p>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: `${tint("red", "10")}`,
                  border: `1px solid ${tint("red", "30")}`,
                  color: D.red,
                  fontSize: "12px",
                  marginBottom: "16px",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: `${tint("mint", "10")}`,
                  border: `1px solid ${tint("mint", "30")}`,
                  color: D.mint,
                  fontSize: "12px",
                  marginBottom: "16px",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            {/* Cách 1: Kết nối Google OAuth tự động */}
            <button
              onClick={handleConnectOAuth}
              disabled={loading}
              type="button"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "11px 20px",
                borderRadius: "8px",
                background: D.blue,
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 600,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.15s ease",
              }}
            >
              <Link2 size={16} />
              {loading ? t("calendar.redirecting") : t("calendar.connectNow")}
            </button>

            {/* Phân cách hoặc */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                margin: "16px 0",
                gap: "10px",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: D.line }} />
              <span style={{ fontSize: "11px", color: D.dim, textTransform: "uppercase" }}>
                hoặc nhập API Key
              </span>
              <div style={{ flex: 1, height: "1px", background: D.line }} />
            </div>

            {/* Cách 2: Tự nhập Google Calendar API Key */}
            <form onSubmit={handleSaveApiKey} style={{ width: "100%", display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Dán Google Calendar API Key..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                disabled={savingKey}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${D.line}`,
                  background: D.surface,
                  color: D.ink,
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={savingKey || !apiKeyInput.trim()}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  background: D.surface,
                  color: D.ink,
                  border: `1px solid ${D.line}`,
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: savingKey || !apiKeyInput.trim() ? "not-allowed" : "pointer",
                  opacity: savingKey || !apiKeyInput.trim() ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {savingKey ? "Đang lưu..." : "Lưu"}
              </button>
            </form>

            {/* Nút Để sau (Đóng pop-up) */}
            <button
              onClick={() => setIsDismissed(true)}
              type="button"
              style={{
                width: "100%",
                padding: "8px 20px",
                borderRadius: "8px",
                background: "transparent",
                color: D.muted,
                fontSize: "12.5px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                marginTop: "14px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = D.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.color = D.muted)}
            >
              Để sau (Nhắc tôi sau)
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
