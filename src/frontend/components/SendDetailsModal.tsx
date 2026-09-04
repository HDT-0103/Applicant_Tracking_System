"use client";

import React, { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { D, tint } from "../lib/shared";
import { useT } from "../lib/i18n";

/**
 * Hỏi phòng và địa chỉ TRƯỚC khi gửi thư mời cho ứng viên.
 *
 * Trước đây nút "Send Details" gửi thẳng với "Conference Room A - 3rd Floor"
 * và "SmartATS HQ, 123 Tech Blvd" — hai chuỗi bịa sẵn nằm trong code. HR bấm
 * một cái là ứng viên nhận được một địa chỉ không có thật, mà HR thì không hề
 * nhìn thấy mình vừa gửi gì.
 */
export function SendDetailsModal({
  open,
  candidateName,
  slotTime,
  sending,
  error,
  onCancel,
  onSend,
}: {
  open: boolean;
  candidateName: string;
  slotTime: string;
  sending: boolean;
  error: string | null;
  onCancel: () => void;
  onSend: (room: string, address: string) => void;
}) {
  const t = useT();
  const [room, setRoom] = useState("");
  const [address, setAddress] = useState("");

  // Mở lại cho ứng viên khác thì phải là form trắng: giữ lại giá trị cũ là
  // đúng cái cách một địa chỉ sai được gửi đi mà không ai đọc lại.
  useEffect(() => {
    if (open) {
      setRoom("");
      setAddress("");
    }
  }, [open]);

  if (!open) return null;

  const ready = room.trim().length > 0 && address.trim().length > 0;

  const field: React.CSSProperties = {
    width: "100%",
    fontSize: 12,
    padding: "8px 10px",
    border: `1px solid ${D.line}`,
    borderRadius: 5,
    background: D.surface,
    color: D.ink,
    outline: "none",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("sendDetails.title")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: 440,
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
            <MapPin size={14} strokeWidth={1.8} color={D.blue} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.ink }}>
              {t("sendDetails.title")}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("common.close")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: D.muted }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, color: D.sub, lineHeight: 1.6, margin: 0 }}>
            {t("sendDetails.intro", { name: candidateName })}{" "}
            <strong style={{ color: D.ink }}>{slotTime}</strong>.
          </p>

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>{t("sendDetails.room")}</span>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder={t("sendDetails.roomPlaceholder")}
              style={field}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>{t("sendDetails.address")}</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("sendDetails.addressPlaceholder")}
              style={field}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 11.5,
                color: D.red,
                background: `${tint("red", "0D")}`,
                border: `1px solid ${tint("red", "28")}`,
                borderRadius: 5,
                padding: "8px 10px",
              }}
            >
              {error}
            </div>
          )}
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
            style={{
              padding: "7px 14px",
              border: `1px solid ${D.line}`,
              borderRadius: 5,
              background: D.canvas,
              cursor: "pointer",
              fontSize: 11,
              color: D.sub,
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSend(room.trim(), address.trim())}
            disabled={!ready || sending}
            style={{
              padding: "7px 16px",
              border: "none",
              borderRadius: 5,
              background: D.blue,
              color: "#fff",
              cursor: ready && !sending ? "pointer" : "default",
              fontSize: 11.5,
              fontWeight: 600,
              opacity: ready && !sending ? 1 : 0.5,
            }}
          >
            {sending ? t("sendDetails.sending") : t("sendDetails.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
