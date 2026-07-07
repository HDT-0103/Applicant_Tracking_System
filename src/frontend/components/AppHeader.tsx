"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Search, RefreshCw, ChevronRight, Loader2, Shield } from "lucide-react";
import { D, Dot, Badge, globalStyles } from "../lib/shared";
import { useAuth, type UserRole } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";

const ROLE_LABELS: Record<UserRole, string> = {
  recruiter: "Recruiter",
  interviewer: "Interviewer",
  admin: "Admin",
  tech_lead: "Tech Lead",
  hr: "HR Manager",
};

interface AppHeaderProps {
  onRunSync?: () => void;
  candidateName?: string | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onRunSync, candidateName }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const { user, logout, canUpload, devSetRole } = useAuth();
  const { syncCandidateProfile, candidateUuid } = useWorkspace();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setShowRoleMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isLanding  = pathname === "/";
  const isCandidatePage   = pathname === "/candidate-profile";
  const isEnrichedCandidatePage   = pathname === "/candidate-profile/enriched";
  const isMainPageSuccess = isLanding && onRunSync !== undefined; // When we're on main page with PDF

  const handleRunSync = async () => {
    setSyncing(true);
    try {
      // If we have a custom onRunSync, use that
      if (onRunSync) {
        setTimeout(() => {
          setSyncing(false);
          onRunSync();
        }, 1400);
      } 
      // Otherwise, use sync API from workspace
      else {
        const response = await syncCandidateProfile();
        setSyncing(false);
        router.push(`${response.redirect}?uuid=${candidateUuid}`);
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncing(false);
    }
  };

  const showRunSync = !isLanding || onRunSync !== undefined;
  const canClickRunSync = onRunSync !== undefined || isCandidatePage || isEnrichedCandidatePage;
  const isSynced = false;

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
      {!isLanding || onRunSync !== undefined ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginLeft: 20,
          fontSize: 11.5, color: D.muted, fontFamily: D.font,
        }}>
          <span
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/")}
          >Candidates</span>
          <ChevronRight size={11} strokeWidth={2} color={D.dim} />
          <span style={{ color: D.sub, fontWeight: 500 }}>{candidateName || "Candidate"}</span>
          {isEnrichedCandidatePage && (
            <>
              <ChevronRight size={11} strokeWidth={2} color={D.dim} />
              <span style={{ color: D.blue, fontWeight: 500 }}>Profile Enrichment</span>
            </>
          )}
        </div>
      ) : null}

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
        {/* Run Sync button */}
        {showRunSync && (
          <button
            onClick={handleRunSync}
            disabled={!canClickRunSync || syncing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px",
              border: `1px solid ${isSynced ? D.line : D.blue}`,
              borderRadius: 6,
              background: isSynced ? D.surface : D.blue,
              cursor: canClickRunSync ? "pointer" : "default",
              fontSize: 11.5, fontWeight: 600,
              color: isSynced ? D.dim : "#fff",
              fontFamily: D.font,
              transition: "all 0.2s ease",
              opacity: syncing ? 0.75 : 1,
            }}
          >
            {syncing
              ? <Loader2 size={11} strokeWidth={2} color={isSynced ? D.dim : "#fff"} style={{ animation: "spin 0.8s linear infinite" }} />
              : <RefreshCw size={11} strokeWidth={2} color={isSynced ? D.dim : "#fff"} />
            }
            {syncing ? "Syncing…" : isSynced ? "Synced" : "Run Sync"}
            {isSynced && (
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

        <div ref={roleRef} style={{ position: "relative" }}>
          <div
            onClick={() => setShowRoleMenu((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: "50%", background: D.blue,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, fontWeight: 700, color: "#fff",
            }}>{user?.name.charAt(0).toUpperCase()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: D.ink, lineHeight: 1.1 }}>{user?.name}</span>
              <span style={{ fontSize: 9.5, color: D.dim, lineHeight: 1.2 }}>{user?.role ? ROLE_LABELS[user.role] : ''}</span>
            </div>
          </div>
          {showRoleMenu && user?.id === "demo-12345" && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 6, minWidth: 160,
              background: D.canvas, border: `1px solid ${D.line}`, borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 100, overflow: "hidden",
            }}>
              <div style={{ padding: "6px 10px", fontSize: 9.5, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Demo Role</div>
              {(["hr", "tech_lead"] as const).map((r) => (
                <div key={r} onClick={() => { devSetRole(r); setShowRoleMenu(false); }}
                  style={{
                    padding: "6px 10px", fontSize: 11.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    background: user?.role === r ? D.blueSoft : "transparent",
                    color: user?.role === r ? D.blue : D.ink, fontWeight: user?.role === r ? 600 : 400,
                  }}
                >
                  <Shield size={10} strokeWidth={2} color={user?.role === r ? D.blue : D.dim} />
                  {ROLE_LABELS[r]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </nav>
  );
};
