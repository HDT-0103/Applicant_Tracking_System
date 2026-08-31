"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/AppShell";
import { D } from "../lib/shared";
import {
  readMustHave,
  topLanguages,
  candidateContext,
} from "../lib/candidateSummary";
import { getDashboard } from "../services/catalogService";
import { BarChart3, CalendarDays, Loader2, Send, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getReviewStatuses, ReviewStatus } from "../services/reviewService";
import { sendInterviewDetails } from "../services/schedulingService";
import { SendDetailsModal } from "../components/SendDetailsModal";

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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<ExtendedCandidate | null>(null);
  /** Băng thông báo sau khi gửi. `alert()` chặn cả tab và không khớp với phần còn lại của app. */
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Một request duy nhất, đi qua backend.
      //
      // Trước đây chỗ này `select` thẳng vào Supabase bằng anon key — khoá nằm
      // trong bundle JS công khai, nên toàn bộ bảng `candidates` đọc được mà
      // không cần đăng nhập, và tầng che PII ở backend bị đi vòng hoàn toàn.
      // Endpoint mới lọc theo hội đồng của người đang đăng nhập và che PII
      // theo role trước khi trả về.
      let dashboard;
      try {
        dashboard = await getDashboard();
      } catch (err) {
        if (!mounted) return;
        setLoading(false);
        setNotice(null);
        setSendError(err instanceof Error ? err.message : "Could not load candidates.");
        return;
      }
      if (!mounted) return;

      const slots = dashboard.slots;

      const reviewByUuid = await getReviewStatuses(
        dashboard.candidates.map((c) => c.candidate_uuid),
      ).catch(() => ({} as Record<string, ReviewStatus>));

      const now = new Date().toISOString();
      const mapped = dashboard.candidates.map((c) => {
        const ts = c.created_at ? new Date(c.created_at).getTime() : Date.now();
        const elapsed = Date.now() - ts;
        let time: string;
        if (elapsed < 60000) time = "Just now";
        else if (elapsed < 3600000) time = `${Math.floor(elapsed / 60000)}m ago`;
        else if (elapsed < 86400000) time = `${Math.floor(elapsed / 3600000)}h ago`;
        else time = `${Math.floor(elapsed / 86400000)}d ago`;

        const futureSlot = slots.find(
          (s) => s.candidate_uuid === c.candidate_uuid && s.start_time > now,
        );

        return {
          uuid: c.candidate_uuid,
          name: c.full_name || "Unknown Candidate",
          email: c.email || undefined,
          role: c.title || "General Application",
          score: c.match_confidence_score ?? null,
          time,
          scheduledSlot: futureSlot || null,
          reviewStatus: reviewByUuid[c.candidate_uuid] ?? null,
          context: candidateContext(c.company, c.current_location),
          languages: topLanguages(c.top_languages),
          repoCount: c.public_repos_count ?? null,
          mustHave: readMustHave(c.skills_matrix),
        };
      });

      if (mounted) {
        setCandidates(mapped);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const openSendDetails = (e: React.MouseEvent, c: ExtendedCandidate) => {
    e.stopPropagation();
    if (!c.scheduledSlot?.id) return;
    setSendError(null);
    setNotice(null);
    setDetailsFor(c);
  };

  const handleSendDetails = async (room: string, address: string) => {
    const c = detailsFor;
    if (!c?.scheduledSlot?.id) return;
    setSending(true);
    setSendError(null);
    try {
      await sendInterviewDetails(c.scheduledSlot.id, room, address);
      setDetailsFor(null);
      setNotice(`Interview details sent to ${c.name}.`);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send the email.");
    } finally {
      setSending(false);
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
               type="button"
               onClick={(e) => openSendDetails(e, c)}
               style={{
                 padding: "6px 12px", borderRadius: 6, background: D.blue, color: "#fff",
                 fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                 transition: "background 0.15s ease",
               }}
             >
                <Send size={14} />
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
      <SendDetailsModal
        open={detailsFor !== null}
        candidateName={detailsFor?.name ?? ""}
        slotTime={
          detailsFor?.scheduledSlot
            ? new Date(detailsFor.scheduledSlot.start_time).toLocaleString("en-US")
            : ""
        }
        sending={sending}
        error={sendError}
        onCancel={() => setDetailsFor(null)}
        onSend={handleSendDetails}
      />

      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${D.mint}40`,
            background: `${D.mint}10`,
            color: D.mint,
            fontSize: 12.5,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
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
