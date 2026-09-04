"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { D } from "../lib/shared";
import { useT } from "../lib/i18n";

/**
 * Hộp xác nhận cho hành động không lùi lại được.
 *
 * Thay cho `window.confirm`, thứ có ba vấn đề: nó khoá cả tab trình duyệt,
 * nó hiện ra với giao diện hệ điều hành chẳng liên quan gì tới app, và nó
 * đồng bộ nên không thể hiện trạng thái "đang xử lý" — người dùng bấm xong
 * chỉ thấy đứng hình, rồi bấm lại.
 *
 * Mặc định `tone` là "danger" vì hộp này chỉ dùng cho việc phá huỷ; muốn hỏi
 * một câu bình thường thì đã không cần tới nó.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  // Esc để thoát: một hộp thoại phá huỷ mà chỉ đóng được bằng cách bấm đúng
  // nút "Cancel" là cái bẫy cho người dùng bàn phím.
  React.useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: "calc(100vw - 32px)",
          background: D.canvas,
          borderRadius: 10,
          border: `1px solid ${D.line}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: `1px solid ${D.line}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} strokeWidth={2} color={D.red} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.ink }}>{title}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={t("common.close")}
            style={{ background: "none", border: "none", cursor: busy ? "default" : "pointer", padding: 2, color: D.muted }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div style={{ padding: 18, fontSize: 12.5, color: D.sub, lineHeight: 1.6 }}>
          {message}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 18px",
            borderTop: `1px solid ${D.line}`,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "7px 14px",
              border: `1px solid ${D.line}`,
              borderRadius: 5,
              background: D.canvas,
              cursor: busy ? "default" : "pointer",
              fontSize: 11,
              color: D.sub,
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "7px 16px",
              border: "none",
              borderRadius: 5,
              background: D.red,
              color: "#fff",
              cursor: busy ? "default" : "pointer",
              fontSize: 11.5,
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? t("confirm.working") : (confirmLabel ?? t("confirm.confirm"))}
          </button>
        </div>
      </div>
    </div>
  );
}
