"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../components/AppShell";
import { D, tint } from "../lib/shared";
import {
  readMustHave,
  topLanguages,
  candidateContext,
} from "../lib/candidateSummary";
import { getDashboard, type DashboardData } from "../services/catalogService";
import { DASHBOARD_QUERY, fetchQuery, getQueryData } from "../lib/queryCache";
import {
  candidateDisplayName,
  candidateInitials,
  isMasked,
} from "../lib/candidateLabel";
import { useLang, useT } from "../lib/i18n";
import { BarChart3, CalendarDays, Loader2, Send, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getReviewStatuses, ReviewStatus } from "../services/reviewService";
import { sendInterviewDetails } from "../services/schedulingService";
import { SendDetailsModal } from "../components/SendDetailsModal";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface ExtendedCandidate {
  uuid: string;
  /** Tên thật, hoặc `Candidate #1a2b3c4d` khi bị che / chưa có — xem lib/candidateLabel. */
  name: string;
  initials: string;
  email?: string;
  /**
   * Tin tuyển dụng ứng viên nộp vào (null khi thiếu hoặc bị che). Dịch thành
   * "Applying for: …" lúc render — KHÔNG phải chức danh hiện tại của ứng viên.
   */
  appliedJobTitle: string | null;
  score: number | null;
  /** Mili-giây kể từ lúc nộp, tính lúc tải; dịch thành "5m ago" lúc render để đổi ngôn ngữ không cần tải lại. */
  elapsedMs: number;
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

/** "Just now" / "5m ago" / "3h ago" / "2d ago" — cùng ngưỡng như trước, chỉ đổi chỗ dịch. */
function relativeTime(t: Translate, elapsed: number): string {
  if (elapsed < 60000) return t("time.justNow");
  if (elapsed < 3600000) return t("time.minutesAgo", { n: Math.floor(elapsed / 60000) });
  if (elapsed < 86400000) return t("time.hoursAgo", { n: Math.floor(elapsed / 3600000) });
  return t("time.daysAgo", { n: Math.floor(elapsed / 86400000) });
}

/** Dòng phụ dưới tên: ghi rõ "Applying for" để không bị đọc thành chức danh hiện tại. */
function appliedForText(t: Translate, title: string | null): string {
  return title
    ? t("candidate.applyingFor", { title })
    : t("candidate.generalApplication");
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [candidates, setCandidates] = useState<ExtendedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<ExtendedCandidate | null>(null);
  /** Băng thông báo sau khi gửi. `alert()` chặn cả tab và không khớp với phần còn lại của app. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Đọc trạng thái duyệt hỏng. Hồ sơ vẫn hiện, nhưng phân nhóm sẽ không chính xác. */
  const [reviewError, setReviewError] = useState<string | null>(null);
  /** Hồ sơ đã hiện, trạng thái duyệt còn đang về: phân nhóm tạm thời. */
  const [reviewLoading, setReviewLoading] = useState(false);

  /** Dựng danh sách từ dữ liệu dashboard + trạng thái duyệt (có thể rỗng). */
  const applyDashboard = useCallback(
    (dashboard: DashboardData, reviewByUuid: Record<string, ReviewStatus>) => {
      const slots = dashboard.slots;
      const now = new Date().toISOString();
      const mapped = dashboard.candidates.map((c) => {
        const ts = c.created_at ? new Date(c.created_at).getTime() : Date.now();
        const elapsedMs = Date.now() - ts;

        const futureSlot = slots.find(
          (s) => s.candidate_uuid === c.candidate_uuid && s.start_time > now,
        );

        // Tin bị ABAC che về "***" thì coi như không có, giống appliedForLabel cũ.
        const jobTitle =
          typeof c.applied_job_title === "string" ? c.applied_job_title.trim() : "";

        return {
          uuid: c.candidate_uuid,
          name: candidateDisplayName(c.full_name, c.candidate_uuid),
          initials: candidateInitials(c.full_name, c.candidate_uuid),
          email: c.email || undefined,
          appliedJobTitle: jobTitle && !isMasked(jobTitle) ? jobTitle : null,
          score: c.match_confidence_score ?? null,
          elapsedMs,
          scheduledSlot: futureSlot || null,
          reviewStatus: reviewByUuid[c.candidate_uuid] ?? null,
          context: candidateContext(c.company, c.current_location),
          languages: topLanguages(c.top_languages),
          repoCount: c.public_repos_count ?? null,
          mustHave: readMustHave(c.skills_matrix),
        };
      });
      setCandidates(mapped);
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    const REVIEW_QUERY = "review:batch";

    // Có bản cache (vừa rời trang rồi quay lại) thì vẽ NGAY, rồi làm mới ngầm.
    // Trước đây mỗi lần về dashboard là vòng xoay vài giây dù dữ liệu vừa có.
    const cachedDashboard = getQueryData<DashboardData>(DASHBOARD_QUERY);
    const cachedReview = getQueryData<Record<string, ReviewStatus>>(REVIEW_QUERY) ?? {};
    if (cachedDashboard) {
      applyDashboard(cachedDashboard, cachedReview);
      setLoading(false);
    }

    (async () => {
      // Một request đi qua backend: lọc theo phạm vi người đăng nhập và che
      // PII theo role trước khi trả về.
      let dashboard: DashboardData;
      try {
        dashboard = await fetchQuery(DASHBOARD_QUERY, getDashboard);
      } catch (err) {
        if (!mounted) return;
        setLoading(false);
        setNotice(null);
        setSendError(err instanceof Error ? err.message : t("dashboard.loadError"));
        return;
      }
      if (!mounted) return;

      // Hồ sơ hiện TRƯỚC, trạng thái duyệt đổ vào sau. Chờ cả hai là bắt
      // người dùng nhìn vòng xoay suốt thời gian của request chậm nhất.
      applyDashboard(dashboard, cachedReview);
      setLoading(false);
      setReviewLoading(true);

      // Hỏng ở đây KHÔNG được làm hồ sơ biến mất — hồ sơ vẫn hiện, chỉ là
      // chưa biết trạng thái duyệt. Nhưng phải nói ra: nuốt lỗi rồi để danh
      // sách trống là cách hỏng tệ nhất, vì trông y hệt "không có ứng viên nào".
      const uuids = dashboard.candidates.map((c) => c.candidate_uuid);
      try {
        const reviewByUuid = uuids.length
          ? await fetchQuery(REVIEW_QUERY, () => getReviewStatuses(uuids))
          : {};
        if (!mounted) return;
        applyDashboard(dashboard, reviewByUuid);
        setReviewError(null);
      } catch (err) {
        if (!mounted) return;
        setReviewError(err instanceof Error ? err.message : t("dashboard.reviewLoadError"));
      } finally {
        if (mounted) setReviewLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // Chỉ tải một lần; đổi ngôn ngữ không được kéo lại dữ liệu. Hai chuỗi lỗi
    // dùng `t` ở đây là của lần tải đó, chấp nhận giữ ngôn ngữ lúc xảy ra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDashboard]);

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
      setNotice(t("dashboard.sentTo", { name: c.name }));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("dashboard.sendError"));
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
        {c.initials}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: D.ink, marginBottom: 2 }}>
          {c.name}
        </div>
        <div style={{ fontSize: 12, color: D.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>{appliedForText(t, c.appliedJobTitle)}</span>
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
              <span style={{ fontSize: 10.5, color: D.dim }}>{t("dashboard.repoCount", { n: c.repoCount })}</span>
            )}
          </div>
        )}
      </div>

      {/* Khớp bao nhiêu kỹ năng BẮT BUỘC — phần "vì sao" đứng sau điểm số.
          Một con số trần trụi thì không ai dám tin. */}
      {c.mustHave && (
        <div
          title={t("dashboard.mustHaveTitle", { matched: c.mustHave.matched, total: c.mustHave.total })}
          style={{
            padding: "4px 10px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: D.mono,
            background:
              c.mustHave.matched === c.mustHave.total ? `${tint("mint", "10")}` : `${tint("amber", "10")}`,
            color: c.mustHave.matched === c.mustHave.total ? D.mint : D.amber,
          }}
        >
          {t("dashboard.skillsCount", { matched: c.mustHave.matched, total: c.mustHave.total })}
        </div>
      )}

      {c.score !== null && (
        <div style={{
          padding: "4px 10px", borderRadius: 99, background: `${tint("blue", "10")}`,
          fontSize: 11, fontWeight: 600, color: D.blue, fontFamily: "monospace",
        }}>
          {t("dashboard.matchPct", { score: c.score })}
        </div>
      )}

      {isScheduled && c.scheduledSlot && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
           <div style={{ fontSize: 12, color: D.blue, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarDays size={14} />
              {new Date(c.scheduledSlot.start_time).toLocaleString(locale)}
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
                {t("dashboard.sendDetails")}
             </button>
           )}
        </div>
      )}

      <div style={{ fontSize: 12, color: D.dim, minWidth: 60, textAlign: "right" }}>
        {relativeTime(t, c.elapsedMs)}
      </div>
    </div>
  );

  // Phân nhóm ứng viên.
  //
  // Quy tắc: mọi ứng viên PHẢI rơi vào đúng một nhóm. Bản trước lọc theo
  // `overall_status` cho cả ba nhóm của HR, nên bất cứ hồ sơ nào có
  // reviewStatus null — chưa ai chấm, hoặc lượt gọi trạng thái hỏng — đều
  // không khớp nhóm nào và BIẾN MẤT khỏi màn hình, không kèm lời giải thích.
  // Đúng một lỗi như thế đã làm cả trang HR trống trơn trong khi Analytics vẫn
  // đếm ra 17 người.
  let hrNeedsApproval: ExtendedCandidate[] = [];
  let toReviewOrSchedule: ExtendedCandidate[] = [];
  let inTechnicalReview: ExtendedCandidate[] = [];
  let scheduled: ExtendedCandidate[] = [];

  const unscheduled = candidates.filter((c) => !c.scheduledSlot);
  scheduled = candidates.filter((c) => c.scheduledSlot !== null);

  if (user?.role === "hr") {
    hrNeedsApproval = unscheduled.filter(
      (c) => c.reviewStatus?.overall_status === "waiting_for_hr",
    );
    toReviewOrSchedule = unscheduled.filter(
      (c) => c.reviewStatus?.overall_status === "ready_to_schedule",
    );
    // Nhóm hứng phần còn lại: chưa qua vòng kỹ thuật, đã bị từ chối, hoặc
    // không đọc được trạng thái. HR vẫn nhìn thấy hồ sơ tồn tại.
    inTechnicalReview = unscheduled.filter(
      (c) =>
        c.reviewStatus?.overall_status !== "waiting_for_hr" &&
        c.reviewStatus?.overall_status !== "ready_to_schedule",
    );
  } else {
    toReviewOrSchedule = unscheduled.filter(
      (c) => c.reviewStatus?.overall_status === "waiting_for_tls" || !c.reviewStatus,
    );
    inTechnicalReview = unscheduled.filter(
      (c) => c.reviewStatus && c.reviewStatus.overall_status !== "waiting_for_tls",
    );
  }

  return (
    <AppShell>
      <SendDetailsModal
        open={detailsFor !== null}
        candidateName={detailsFor?.name ?? ""}
        slotTime={
          detailsFor?.scheduledSlot
            ? new Date(detailsFor.scheduledSlot.start_time).toLocaleString(locale)
            : ""
        }
        sending={sending}
        error={sendError}
        onCancel={() => setDetailsFor(null)}
        onSend={handleSendDetails}
      />

      {reviewError && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${tint("amber", "40")}`,
            background: `${tint("amber", "10")}`,
            color: D.amber,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {t("dashboard.reviewStatusWarning")} {reviewError}
        </div>
      )}

      {reviewLoading && !reviewError && (
        <div role="status" style={{ marginBottom: 12, fontSize: 12, color: D.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={12} className="animate-spin" /> {t("dashboard.reviewLoading")}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${tint("mint", "40")}`,
            background: `${tint("mint", "10")}`,
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
            aria-label={t("common.dismiss")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: D.ink, marginBottom: 8 }}>
                {t("dashboard.title")}
              </h1>
              <p style={{ fontSize: 14, color: D.muted }}>
                {t("dashboard.welcome")}
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
                  width: 48, height: 48, borderRadius: 10, background: `${tint("purple", "10")}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BarChart3 size={24} strokeWidth={1.5} color={D.purple} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: D.ink }}>{t("dashboard.viewAnalytics")}</div>
                  <div style={{ fontSize: 12, color: D.muted }}>{t("dashboard.viewAnalyticsHint")}</div>
                </div>
              </button>
            </div>

            {loading ? (
              <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }} aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ padding: "16px 20px", borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: D.surface, animation: "skelShimmer 1.4s ease-in-out infinite" }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ height: 12, width: `${38 + i * 9}%`, borderRadius: 4, background: D.surface, animation: "skelShimmer 1.4s ease-in-out infinite" }} />
                      <div style={{ height: 10, width: `${24 + i * 7}%`, borderRadius: 4, background: D.surface, animation: "skelShimmer 1.4s ease-in-out infinite" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {user?.role === "hr" && hrNeedsApproval.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: D.amber, marginBottom: 16 }}>
                      {t("dashboard.pendingHrDecision")}
                    </h2>
                    <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                      {hrNeedsApproval.map((c) => renderCandidateRow(c, false))}
                    </div>
                  </div>
                )}

                {/* Table 1: Based on Role */}
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                    {user?.role === "hr" ? t("dashboard.readyForScheduling") : t("dashboard.pendingReview")}
                  </h2>
                  <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                    {toReviewOrSchedule.length === 0 ? (
                      <div style={{ padding: "24px", textAlign: "center", color: D.muted, fontSize: 13 }}>{t("dashboard.noCandidates")}</div>
                    ) : (
                      toReviewOrSchedule.map((c) => renderCandidateRow(c, false))
                    )}
                  </div>
                </div>

                {inTechnicalReview.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: D.sub, marginBottom: 16 }}>
                      {user?.role === "hr" ? t("dashboard.inTechnicalReview") : t("dashboard.alreadyDecided")}
                    </h2>
                    <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                      {inTechnicalReview.map((c) => renderCandidateRow(c, false))}
                    </div>
                  </div>
                )}

                {/* Table 2: Scheduled Interviews for HR */}
                {user?.role === "hr" && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                      {t("dashboard.scheduledInterviews")}
                    </h2>
                    <div style={{ borderRadius: 12, background: D.canvas, border: `1px solid ${D.line}`, overflow: "hidden" }}>
                      {scheduled.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: D.muted, fontSize: 13 }}>{t("dashboard.noScheduled")}</div>
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
