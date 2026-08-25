"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/AppShell";
import { D } from "../lib/shared";
import {
  firstOf,
  readMustHave,
  topLanguages,
  candidateContext,
} from "../lib/candidateSummary";
import { guarded, supabase } from "../lib/db";
import { BarChart3, CalendarDays, Loader2, Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getReviewStatus, ReviewStatus } from "../services/reviewService";
import { sendInterviewDetails } from "../services/schedulingService";

interface ExtendedCandidate {
  uuid: string;
  name: string;
  email?: string;
  role: string;
  score: number | null;
  time: string;
  scheduledSlot: any | null;
  reviewStatus: ReviewStatus | null;
  /** "Công ty · Địa điểm" — bỏ trống vế nào thiếu, không hiện dấu chấm mồ côi. */
  context: string | null;
  /** Ngôn ngữ dùng nhiều nhất trên GitHub, tối đa 3. */
  languages: string[];
  repoCount: number | null;
  /** Khớp bao nhiêu trên tổng số kỹ năng BẮT BUỘC của tin tuyển dụng. */
  mustHave: { matched: number; total: number } | null;
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<ExtendedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 1. Fetch recent candidates.
      // CỐ Ý KHÔNG lấy race / gender_identity / disability_status /
      // military_status / age_group: đó là dữ liệu EEO cho báo cáo tổng hợp,
      // đưa lên màn hình sàng lọc là tạo thiên kiến ngay chỗ ra quyết định.
      const cData = await guarded("load recent candidates", () => supabase
        .from("candidates")
        .select(`
          uuid,
          full_name,
          email,
          created_at,
          current_company,
          current_location,
          applications!left (
            job_posting_id,
            jobs_posting!left (job_title)
          ),
          enrichment_profiles!left (
            match_confidence_score,
            skill_matrix
          ),
          github_profiles!left (
            public_repos_count,
            top_languages
          )
        `)
        .order("created_at", { ascending: false })
        .limit(30));

      if (!mounted) return;
      if (!cData) {
        setLoading(false);
        return;
      }

      // 2. Fetch confirmed slots
      const { data: sData } = await supabase
        .from("confirmed_slots")
        .select("*");

      const slots = sData || [];

      // 3. Map candidates and fetch their review status
      const mapped = await Promise.all(cData.map(async (c: any) => {
        const app = firstOf<any>(c.applications);
        const ep = firstOf<any>(c.enrichment_profiles);
        const gh = firstOf<any>(c.github_profiles);
        
        const ts = c.created_at ? new Date(c.created_at).getTime() : Date.now();
        const elapsed = Date.now() - ts;
        let time: string;
        if (elapsed < 60000) time = "Just now";
        else if (elapsed < 3600000) time = `${Math.floor(elapsed / 60000)}m ago`;
        else if (elapsed < 86400000) time = `${Math.floor(elapsed / 3600000)}h ago`;
        else time = `${Math.floor(elapsed / 86400000)}d ago`;

        // Find a future slot for this candidate
        const now = new Date().toISOString();
        const futureSlot = slots.find((s: any) => s.candidate_uuid === c.uuid && s.start_time > now);
        
        let reviewStatus: ReviewStatus | null = null;
        try {
           reviewStatus = await getReviewStatus(c.uuid);
        } catch {
           // ignore if not reviewed
        }

        return {
          uuid: c.uuid,
          name: c.full_name || "Unknown Candidate",
          email: c.email || undefined,
          role: app?.jobs_posting?.job_title || "General Application",
          score: ep?.match_confidence_score ?? null,
          time,
          scheduledSlot: futureSlot || null,
          reviewStatus,
          context: candidateContext(c.current_company, c.current_location),
          languages: topLanguages(gh?.top_languages),
          repoCount: gh?.public_repos_count ?? null,
          mustHave: readMustHave(ep?.skill_matrix),
        };
      }));

      if (mounted) {
        setCandidates(mapped);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSendEmail = async (e: React.MouseEvent, c: ExtendedCandidate) => {
    e.stopPropagation();
    if (!c.scheduledSlot?.id) return;
    setSendingEmailId(c.scheduledSlot.id);
    try {
      await sendInterviewDetails(
        c.scheduledSlot.id,
        "Conference Room A - 3rd Floor",
        "SmartATS HQ, 123 Tech Blvd"
      );
      alert(`Interview room & location details sent to ${c.name} successfully!`);
    } catch (err: any) {
      alert("Failed to send email: " + (err?.message || "Unknown error"));
    } finally {
      setSendingEmailId(null);
    }
  };

  const renderCandidateRow = (c: ExtendedCandidate, isScheduled: boolean) => (
    <div
      key={c.uuid}
      onClick={() => router.push(`/candidate-profile/enriched?uuid=${c.uuid}`)}
      style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${D.line}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = D.surface; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: `linear-gradient(135deg, ${D.blue} 0%, ${D.blueDeep} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 600, color: "#fff", flexShrink: 0,
      }}>
        {c.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: D.ink, marginBottom: 2 }}>
          {c.name}
        </div>
        <div style={{ fontSize: 12, color: D.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>{c.role}</span>
          {c.context && (
            <>
              <span style={{ color: D.dim }}>•</span>
              <span>{c.context}</span>
            </>
          )}
        </div>

        {/* Bằng chứng kỹ thuật rút từ GitHub. Hiện ngay ở danh sách để người
            tuyển dụng không phải mở từng hồ sơ mới biết ứng viên làm gì. */}
        {(c.languages.length > 0 || c.repoCount !== null) && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
            {c.languages.map((lang) => (
              <span
                key={lang}
                style={{
                  padding: "1px 6px",
                  borderRadius: D.r1,
                  background: D.surface,
                  border: `1px solid ${D.lineSoft}`,
                  fontSize: 10.5,
                  color: D.sub,
                }}
              >
                {lang}
              </span>
            ))}
            {c.repoCount !== null && (
              <span style={{ fontSize: 10.5, color: D.dim }}>{c.repoCount} repo</span>
            )}
          </div>
        )}
      </div>

      {/* Khớp bao nhiêu kỹ năng BẮT BUỘC — phần "vì sao" đứng sau điểm số.
          Một con số trần trụi thì không ai dám tin. */}
      {c.mustHave && (
        <div
          title={`Matches ${c.mustHave.matched} of ${c.mustHave.total} required skills`}
          style={{
            padding: "4px 10px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: D.mono,
            background:
              c.mustHave.matched === c.mustHave.total ? `${D.mint}10` : `${D.amber}10`,
            color: c.mustHave.matched === c.mustHave.total ? D.mint : D.amber,
          }}
        >
          {c.mustHave.matched}/{c.mustHave.total} skills
        </div>
      )}

      {c.score !== null && (
        <div style={{
          padding: "4px 10px", borderRadius: 99, background: `${D.blue}10`,
          fontSize: 11, fontWeight: 600, color: D.blue, fontFamily: "monospace",
        }}>
          {c.score}% match
        </div>
      )}

      {isScheduled && c.scheduledSlot && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
           <div style={{ fontSize: 12, color: D.blue, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarDays size={14} />
              {new Date(c.scheduledSlot.start_time).toLocaleString("en-US")}
           </div>
           {user?.role === "hr" && (
             <button
               onClick={(e) => handleSendEmail(e, c)}
               disabled={sendingEmailId === c.scheduledSlot.id}
               style={{
                 padding: "6px 12px", borderRadius: 6, background: D.blue, color: "#fff",
                 fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                 opacity: sendingEmailId === c.scheduledSlot.id ? 0.7 : 1,
                 transition: "background 0.15s ease",
               }}
             >
                {sendingEmailId === c.scheduledSlot.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send Details
             </button>
           )}
        </div>
      )}

      <div style={{ fontSize: 12, color: D.dim, minWidth: 60, textAlign: "right" }}>
        {c.time}
      </div>
    </div>
  );

  // Filter candidates based on Role
  let hrNeedsApproval: ExtendedCandidate[] = [];
  let toReviewOrSchedule: ExtendedCandidate[] = [];
  let scheduled: ExtendedCandidate[] = [];

  if (user?.role === "hr") {
    hrNeedsApproval = candidates.filter((c) => !c.scheduledSlot && c.reviewStatus?.overall_status === "waiting_for_hr");
    toReviewOrSchedule = candidates.filter((c) => !c.scheduledSlot && c.reviewStatus?.overall_status === "ready_to_schedule");
    scheduled = candidates.filter((c) => c.scheduledSlot !== null);
  } else {
    // Tech Lead: Pending review
    toReviewOrSchedule = candidates.filter((c) => !c.scheduledSlot && (c.reviewStatus?.overall_status === "waiting_for_tls" || !c.reviewStatus));
  }

  return (
    <AppShell>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: D.ink, marginBottom: 8 }}>
                Dashboard Overview
              </h1>
              <p style={{ fontSize: 14, color: D.muted }}>
                Welcome back! Here&apos;s what&apos;s happening with your recruitment pipeline today.
              </p>
            </div>

            <div style={{ marginBottom: 32 }}>
              <button
                type="button"
                onClick={() => router.push("/analytics")}
                style={{
                  padding: "20px", borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`,
                  cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 16,
                }}
              >
                <div style={{ 
                  width: 48, height: 48, borderRadius: 10, background: `${D.purple}10`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BarChart3 size={24} strokeWidth={1.5} color={D.purple} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: D.ink }}>View Analytics</div>
                  <div style={{ fontSize: 12, color: D.muted }}>Recruitment metrics and insights</div>
                </div>
              </button>
            </div>

            {loading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2 size={32} className="animate-spin text-blue-500 mx-auto" />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {user?.role === "hr" && hrNeedsApproval.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: D.amber, marginBottom: 16 }}>
                      Pending HR Decision (Passed Tech Lead Review)
                    </h2>
                    <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                      {hrNeedsApproval.map((c) => renderCandidateRow(c, false))}
                    </div>
                  </div>
                )}

                {/* Table 1: Based on Role */}
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                    {user?.role === "hr" ? "Ready for Scheduling" : "Candidates Pending Review"}
                  </h2>
                  <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                    {toReviewOrSchedule.length === 0 ? (
                      <div style={{ padding: "24px", textAlign: "center", color: D.muted, fontSize: 13 }}>No candidates found</div>
                    ) : (
                      toReviewOrSchedule.map((c) => renderCandidateRow(c, false))
                    )}
                  </div>
                </div>

                {/* Table 2: Scheduled Interviews for HR */}
                {user?.role === "hr" && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                      Scheduled Interviews
                    </h2>
                    <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                      {scheduled.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: D.muted, fontSize: 13 }}>No scheduled interviews yet</div>
                      ) : (
                        scheduled.map((c) => renderCandidateRow(c, true))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
    </AppShell>
  );
}
