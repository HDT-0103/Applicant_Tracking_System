"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, Cpu, Database } from "lucide-react";
import { T, dotGrid } from "./authTheme";

interface AuthShellProps {
  heading: string;
  subheading: string;
  error?: string | null;
  children: React.ReactNode; // form
  footer: React.ReactNode;
}

const PANEL_POINTS = [
  { icon: Cpu, text: "AI verification & semantic candidate ranking" },
  { icon: ShieldCheck, text: "ABAC access control with PII masking" },
  { icon: Database, text: "pgvector search over enriched profiles" },
];

export const AuthShell: React.FC<AuthShellProps> = ({
  heading,
  subheading,
  error,
  children,
  footer,
}) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        fontFamily: T.font,
        background: T.page,
        color: T.ink,
      }}
      className="auth-shell"
    >
      {/* LEFT — Form */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Brand mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: T.radius,
                background: T.ink,
                color: "#fff",
                fontSize: 17,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              S
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
              SmartATS
            </span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            {heading}
          </h1>
          <p style={{ fontSize: 14, color: T.muted, margin: "6px 0 24px" }}>{subheading}</p>

          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: T.dangerBg,
                border: `1px solid ${T.dangerLine}`,
                borderRadius: T.radius,
                padding: "10px 12px",
                marginBottom: 18,
                color: T.danger,
                fontSize: 13,
              }}
            >
              <ShieldAlert size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {children}

          <div style={{ marginTop: 22, fontSize: 13, color: T.muted, textAlign: "center" }}>
            {footer}
          </div>
        </div>
      </div>

      {/* RIGHT — Brand panel with structural dot-grid */}
      <aside
        className="auth-panel"
        style={{
          position: "relative",
          borderLeft: `1px solid ${T.line}`,
          background: T.panel,
          backgroundImage: dotGrid,
          backgroundSize: "22px 22px",
          backgroundPosition: "center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 56px",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1, maxWidth: 380 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.primary,
              border: `1px solid ${T.line}`,
              background: T.page,
              borderRadius: 999,
              padding: "4px 10px",
              marginBottom: 22,
            }}
          >
            Enterprise ATS
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em", margin: 0 }}>
            AI-powered hiring, governed end to end.
          </h2>
          <p style={{ fontSize: 14, color: T.sub, margin: "14px 0 28px", lineHeight: 1.6 }}>
            Ingest, enrich, and rank candidates with a security model built for
            regulated recruiting teams.
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {PANEL_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: T.sub }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: T.radius,
                    background: T.page,
                    border: `1px solid ${T.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: T.primary,
                  }}
                >
                  <Icon size={15} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 860px) {
          .auth-shell { grid-template-columns: 1fr !important; }
          .auth-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
};
