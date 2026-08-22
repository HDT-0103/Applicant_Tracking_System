"use client";

import React, { useEffect, useState } from "react";
import { Calendar, Link2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { checkCalendarStatus, getGoogleAuthUrl } from "../services/schedulingService";
import { D } from "../lib/shared";

export function RequireCalendarModal() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chỉ check khi user là tech_lead và đã đăng nhập
  const isTechLead = isAuthenticated && user?.role === "tech_lead";

  useEffect(() => {
    if (!isTechLead || authLoading) return;

    let mounted = true;
    checkCalendarStatus()
      .then((res) => {
        if (mounted) setConnected(res.connected);
      })
      .catch(() => {
        if (mounted) setConnected(false);
      });

    return () => {
      mounted = false;
    };
  }, [isTechLead, authLoading]);

  // Nếu không phải tech_lead, hoặc chưa load xong, hoặc đã kết nối -> Không hiện modal
  if (!isTechLead || authLoading || connected === null || connected === true) {
    return null;
  }

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "Failed to initialize Google Calendar authentication");
      setLoading(false);
    }
  };

  return (
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
          maxWidth: "460px",
          background: D.canvas,
          borderRadius: "16px",
          border: `1px solid ${D.line}`,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
          padding: "32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "modalFadeIn 0.2s ease-out",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: `${D.blue}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          <Calendar size={32} color={D.blue} strokeWidth={1.75} />
        </div>

        <h2 style={{ fontSize: "20px", fontWeight: 700, color: D.ink, marginBottom: "8px" }}>
          Google Calendar Connection Required
        </h2>

        <p style={{ fontSize: "13.5px", color: D.muted, lineHeight: 1.5, marginBottom: "24px" }}>
          Welcome, <strong>{user?.name || "Tech Lead"}</strong>. To participate as an interviewer and allow automated interview availability matching, you must connect your Google Calendar.
        </p>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: `${D.red}10`,
              border: `1px solid ${D.red}30`,
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

        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "8px",
            background: D.blue,
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <Link2 size={16} />
          {loading ? "Redirecting to Google..." : "Connect Google Calendar Now"}
        </button>

        <p style={{ fontSize: "11px", color: D.dim, marginTop: "16px" }}>
          You only need to connect your calendar once.
        </p>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
