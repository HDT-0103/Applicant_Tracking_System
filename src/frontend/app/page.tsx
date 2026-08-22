"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../components/AppHeader";
import { LeftSidebar } from "../components/LeftSidebar";
import { D } from "../lib/shared";
import { supabase } from "../lib/supabase";
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
      // 1. Fetch recent candidates
      const { data: cData, error } = await supabase
        .from("candidates")
        .select(`
          uuid,
          full_name,
          email,
          created_at,
          applications!left (
            job_posting_id,
            jobs_posting!left (job_title)
          ),
          enrichment_profiles!left (
            match_confidence_score
          )
        `)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!mounted) return;
      if (error || !cData) {
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
        const app = c.applications?.[0];
        const ep = c.enrichment_profiles?.[0];
        
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
        background: `linear-gradient(135deg, ${D.blue} 0%, #4F46E5 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 600, color: "#fff", flexShrink: 0,
      }}>
        {c.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: D.ink, marginBottom: 2 }}>
          {c.name}
        </div>
        <div style={{ fontSize: 12, color: D.muted }}>
          {c.role}
        </div>
      </div>

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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <LeftSidebar />
        
        <div style={{ flex: 1, overflow: "hidden", background: D.bg }}>
          <div style={{ padding: "32px 40px", height: "100%", overflowY: "auto" }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
