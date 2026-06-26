"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Search, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import { D, Dot, Badge, globalStyles } from "../app/shared";
import { useAuth, type UserRole } from "../../context/AuthContext";

const ROLE_LABELS: Record<UserRole, string> = {
  recruiter: "Recruiter",
  interviewer: "Interviewer",
  admin: "Admin",
};

export const AppHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const { user, logout, canUpload } = useAuth();

  const isLanding  = pathname === "/";
  const isCandidatePage   = pathname === "/candidate-profile"; // Assuming this is equivalent to /candidate
  const isEnrichedCandidatePage   = pathname === "/candidate-profile/enriched"; // Assuming this is equivalent to /candidate/enriched

  const handleRunSync = () => {
    if (!isCandidatePage) return;
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      router.push("/candidate-profile/enriched");
    }, 1400);
  };

  if (!user) return null; // Keep existing auth check

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
      {!isLanding && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginLeft: 20,
          fontSize: 11.5, color: D.muted, fontFamily: D.font,
        }}>
          <span
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/")}
          >Candidates</span>
          <ChevronRight size={11} strokeWidth={2} color={D.dim} />
          <span style={{ color: D.sub, fontWeight: 500 }}>Alex M. Richardson</span> {/* Placeholder name */}
          {isEnrichedCandidatePage && (
            <>
              <ChevronRight size={11} strokeWidth={2} color={D.dim} />
              <span style={{ color: D.blue, fontWeight: 500 }}>Profile Enrichment</span>
            </>
          )}
        </div>
      )}

      {/* Center search */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 7, width: 280,
          padding: "5px 12px", border: `1px solid ${D.line}`,
          borderRadius: 6, background: D.surface,
        }}>
          <Search size={11} color={D.dim} strokeWidth={2} />
          <input
            placeholder="Search candidates, roles, pipelines…"
            style={{
              border: "none", outline: "none", background: "transparent",
              fontSize: 11.5, color: D.ink, fontFamily: D.font, flex: 1, caretColor: D.blue,
            }}
          />
          <span style={{
            fontSize: 9.5, color: D.dim, fontFamily: D.mono, background: D.canvas,
            padding: "1px 5px", borderRadius: 3, border: `1px solid ${D.line}`,
          }}>⌘K</span>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Run Sync — only visible on CandidatePage, dims on EnrichedCandidatePage */}
        {!isLanding && (
          <button
            onClick={handleRunSync}
            disabled={!isCandidatePage || syncing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px",
              border: `1px solid ${isEnrichedCandidatePage ? D.line : D.blue}`,
              borderRadius: 6,
              background: isEnrichedCandidatePage ? D.surface : D.blue,
              cursor: isCandidatePage ? "pointer" : "default",
              fontSize: 11.5, fontWeight: 600,
              color: isEnrichedCandidatePage ? D.dim : "#fff",
              fontFamily: D.font,
              transition: "all 0.2s ease",
              opacity: syncing ? 0.75 : 1,
            }}
          >
            {syncing
              ? <Loader2 size={11} strokeWidth={2} color={isEnrichedCandidatePage ? D.dim : "#fff"} style={{ animation: "spin 0.8s linear infinite" }} />
              : <RefreshCw size={11} strokeWidth={2} color={isEnrichedCandidatePage ? D.dim : "#fff"} />
            }
            {syncing ? "Syncing…" : isEnrichedCandidatePage ? "Synced" : "Run Sync"}
            {isEnrichedCandidatePage && (
              <Badge color={D.mint} bg={D.mintSoft}>
                <Dot color={D.mint} />
                Done
              </Badge>
            )}
          </button>
        )}

        <div style={{ width: 1, height: 16, background: D.line }} />

        <button style={{
          position: "relative", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", width: 28, height: 28,
          justifyContent: "center", borderRadius: 6,
        }}>
          <Bell size={14} color={D.sub} strokeWidth={1.8} />
          <span style={{
            position: "absolute", top: 5, right: 5, width: 5, height: 5,
            borderRadius: "50%", background: D.red, border: `1.5px solid ${D.canvas}`,
          }} />
        </button>

        <div style={{ width: 1, height: 16, background: D.line }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", background: D.blue,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9.5, fontWeight: 700, color: "#fff",
          }}>{user?.name.charAt(0).toUpperCase()}</div> {/* Use actual user initial */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: D.ink, lineHeight: 1.1 }}>{user?.name}</span> {/* Use actual user name */}
            <span style={{ fontSize: 9.5, color: D.dim, lineHeight: 1.2 }}>{user?.role ? ROLE_LABELS[user.role] : ''}</span> {/* Use actual user role */}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </nav>
  );
};
