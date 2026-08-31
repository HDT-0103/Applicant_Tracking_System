import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Shield, GitBranch, Cpu, Globe, Calendar, FileText } from "lucide-react";
import { D, Dot, SectionLabel, Divider } from "@/lib/shared";
import { api } from "@/services/httpClient";
import { openCandidateCv } from "@/services/candidateCvService";
import { type ReviewStatus } from "@/services/reviewService";
import { MatchConfidence } from "./MatchConfidence";
import { SkillMatchPanel } from "@/components/SkillMatchPanel";
import { EnrichedRadar } from "./EnrichedRadar";
import { CareerTimeline } from "./CareerTimeline";
import { ReviewPanel } from "./ReviewPanel";
import type { EnrichedProfile } from "../types";

// ─── Right Panel — Enriched Analytics ───────────────────────────────────────────
export function EnrichedAnalytics({
  data,
  userRole,
  userId,
  candidateUuid,
  reviewStatus,
  onRefreshReview,
}: {
  data: EnrichedProfile | null;
  userRole: string;
  userId?: string;
  candidateUuid: string;
  reviewStatus: ReviewStatus | null;
  onRefreshReview: () => void;
}) {
  const router = useRouter();
  const [cvError, setCvError] = React.useState<string | null>(null);
  const repoCount = data?.github?.public_repos_count ?? 0;
  const skillsCount = data?.analytics?.semantic_tags?.length ?? 0;
  const roleCount = data?.linkedin?.experiences?.length ?? 0;
  const canSchedule =
    userRole === "hr" && reviewStatus?.overall_status === "ready_to_schedule";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: D.canvas,
      }}
    >
      <div
        style={{
          height: 38,
          background: D.canvas,
          borderBottom: `1px solid ${D.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={13} strokeWidth={1.8} color={D.muted} />
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: D.ink,
              letterSpacing: "-0.01em",
            }}
          >
            Unified Candidate Analytics
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontFamily: D.mono,
              color: D.muted,
              padding: "1px 5px",
              border: `1px solid ${D.line}`,
              borderRadius: 3,
              background: D.surface,
            }}
          >
            post-enrichment
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {candidateUuid && (
            <button
              type="button"
              onClick={async () => {
                setCvError(null);
                try {
                  await openCandidateCv(candidateUuid);
                } catch (err) {
                  setCvError(
                    err instanceof Error ? err.message : "Could not open this CV.",
                  );
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 5,
                background: D.surface,
                border: `1px solid ${D.line}`,
                color: D.ink,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={12} strokeWidth={2} color={D.blue} />
              <span>View Original CV</span>
            </button>
          )}
          {cvError && (
            <span role="alert" style={{ fontSize: 10, color: D.red, maxWidth: 180 }}>
              {cvError}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Dot color={D.mint} pulse />
            <span style={{ fontSize: 10, color: D.muted, fontFamily: D.mono }}>
              LIVE
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "clip",
          padding: "20px 22px",
          minHeight: 0,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Match Confidence Score</SectionLabel>
          <MatchConfidence analytics={data?.analytics || null} />
        </div>
        <Divider />
        {/* The "why" behind the number above. A score with no breakdown is
            something a recruiter can only accept or ignore, never check. */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Requirements Breakdown</SectionLabel>
          <SkillMatchPanel
            skillMatrix={data?.skill_matrix}
            score={data?.analytics?.match_confidence_score ?? null}
          />
        </div>
        <Divider />
        <div style={{ marginBottom: 20 }}>
          <EnrichedRadar analytics={data?.analytics || null} />
        </div>
        <Divider />
        <div style={{ marginBottom: 20 }}>
          <CareerTimeline data={data} />
        </div>
        <Divider />

        {/* Enrichment Impact Summary */}
        <div style={{ marginBottom: 12 }}>
          <SectionLabel>Enrichment Impact Summary</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 10,
            }}
          >
            {[
              {
                icon: <GitBranch size={13} strokeWidth={1.8} color={D.blue} />,
                label: "Repos Corroborating",
                value: repoCount.toString(),
                sub: "public repositories",
                color: D.blue,
              },
              {
                icon: (
                  <CheckCircle2 size={13} strokeWidth={1.8} color={D.mint} />
                ),
                label: "Roles Verified",
                value: roleCount.toString(),
                sub: "LinkedIn employment entries",
                color: D.mint,
              },
              {
                icon: <Cpu size={13} strokeWidth={1.8} color={D.purple} />,
                label: "Skills Confirmed",
                value: skillsCount.toString(),
                sub: "from README analysis",
                color: D.purple,
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "11px 13px",
                  borderRadius: 7,
                  background: `${item.color}08`,
                  border: `1px solid ${item.color}20`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {item.icon}
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: item.color,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {item.label.toUpperCase()}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: D.ink,
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                    fontFamily: D.mono,
                  }}
                >
                  {item.value}
                </div>
                <div style={{ fontSize: 10, color: D.muted }}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 5,
              background: D.surface,
              border: `1px solid ${D.line}`,
            }}
          >
            <Globe size={10} strokeWidth={2} color={D.muted} />
            <span style={{ fontSize: 10, color: D.muted, flex: 1 }}>
              Sources:{" "}
              <span style={{ color: D.sub, fontWeight: 500 }}>
                GitHub ({repoCount} repos analyzed)
              </span>
              {" · "}
              <span style={{ color: D.sub, fontWeight: 500 }}>
                LinkedIn ({roleCount} verified positions)
              </span>
            </span>
            <span style={{ fontSize: 9, fontFamily: D.mono, color: D.dim }}>
              Just now
            </span>
          </div>
        </div>
        <Divider />
        <ReviewPanel
          candidateUuid={candidateUuid}
          userRole={userRole}
          userId={userId}
          reviewStatus={reviewStatus}
          onRefresh={onRefreshReview}
        />
        {canSchedule ? (
          <button
            onClick={() =>
              router.push(
                `/schedule?uuid=${candidateUuid}&name=${encodeURIComponent(data?.full_name || "Candidate")}`,
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 14px",
              border: "none",
              borderRadius: 6,
              background: D.blue,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              transition: "all 0.15s ease",
            }}
          >
            <Calendar size={13} strokeWidth={2} />
            Schedule Interview
          </button>
        ) : (
          userRole === "hr" && (
            <div
              style={{
                fontSize: 10,
                color: D.muted,
                textAlign: "center",
                padding: "8px",
                border: `1px dashed ${D.line}`,
                borderRadius: 5,
              }}
            >
              {reviewStatus?.overall_status === "waiting_for_tls"
                ? "⏳ Waiting for the Tech Lead panel to approve before scheduling"
                : reviewStatus?.overall_status === "rejected_by_tls" ||
                    reviewStatus?.overall_status === "rejected_by_hr"
                  ? "❌ Candidate rejected — scheduling unavailable"
                  : reviewStatus?.overall_status === "waiting_for_hr"
                    ? "⚠️ Submit your final HR decision above"
                    : "Submit your review above"}
            </div>
          )
        )}
      </div>
    </div>
  );
}
