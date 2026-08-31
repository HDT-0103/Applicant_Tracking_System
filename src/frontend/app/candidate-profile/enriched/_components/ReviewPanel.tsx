"use client";

import React, { useState } from "react";
import { D, SectionLabel } from "@/lib/shared";
import { submitReview, type ReviewStatus, type ReviewDecision } from "@/services/reviewService";

// ─── Review Panel ──────────────────────────────────────────────────────────────
export function ReviewPanel({
  candidateUuid,
  userRole,
  userId,
  reviewStatus,
  onRefresh,
}: {
  candidateUuid: string;
  userRole: string;
  /** Dùng để biết CHÍNH tech lead này đã chấm chưa — mỗi TL là một phiếu riêng. */
  userId?: string;
  reviewStatus: ReviewStatus | null;
  onRefresh: () => void;
}) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHr = userRole === "hr";
  const status = reviewStatus?.overall_status || "waiting_for_tls";

  // Phiếu của chính người đang xem. HR chỉ có một phiếu; tech_lead thì phải dò
  // trong danh sách vì hội đồng có nhiều người.
  const myDecision: ReviewDecision = isHr
    ? (reviewStatus?.hr_decision ?? "pending")
    : (reviewStatus?.tl_reviews.find((r) => r.reviewer_id === userId)?.decision ?? "pending");

  // HR chỉ được chốt SAU khi hội đồng TL đã qua ngưỡng — nếu không thì quyết
  // định của HR sẽ đi trước dữ liệu kỹ thuật mà nó phải dựa vào.
  const hrBlocked = isHr && status === "waiting_for_tls";
  const canSubmit = myDecision === "pending" && !hrBlocked;

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(candidateUuid, decision, text);
      onRefresh();
    } catch (err) {
      // Backend từ chối có lý do (sai thứ tự duyệt, hết phiên…). Nuốt lỗi thì
      // người duyệt bấm mãi mà không hiểu vì sao phiếu không được ghi.
      setError(err instanceof Error ? err.message : "Could not submit the review.");
    }
    setSubmitting(false);
  };

  const box: React.CSSProperties = {
    marginTop: 8,
    padding: "8px 10px",
    borderRadius: 5,
    border: `1px solid ${D.line}`,
    background: D.surface,
  };

  /** Dòng trạng thái tổng hợp ở cuối panel.
   *
   *  Tên cũ là `alert`, che mất `window.alert` trong cả component — đọc code
   *  ở đây thì tưởng đang gọi hộp thoại trình duyệt. */
  const statusLine = (color: string, label: string) => (
    <div style={{ marginTop: 8, fontSize: 10, color, fontWeight: 600, textAlign: "center" }}>
      {label}
    </div>
  );

  return (
    <div
      style={{
        marginBottom: 20,
        padding: "12px 14px",
        borderRadius: 7,
        border: `1px solid ${D.line}`,
        background: D.surface,
      }}
    >
      <SectionLabel>CV Review</SectionLabel>

      {!reviewStatus ? (
        <div style={box}>
          <div style={{ fontSize: 10, color: D.muted, textAlign: "center" }}>
            ⏳ Loading review status…
          </div>
        </div>
      ) : hrBlocked ? (
        <div style={{ ...box, border: `1px solid ${D.amber}30`, background: `${D.amber}08` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: D.amber, textAlign: "center" }}>
            ⏳ Waiting for the Tech Lead panel — {reviewStatus?.required_tl_approvals} of{" "}
            {reviewStatus?.total_tls} must approve
          </div>
        </div>
      ) : (
        canSubmit && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setDecision("approved")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  border: `1px solid ${decision === "approved" ? D.mint : D.line}`,
                  borderRadius: 5,
                  background: decision === "approved" ? D.mintSoft : D.canvas,
                  fontSize: 11,
                  fontWeight: 600,
                  color: decision === "approved" ? D.mint : D.sub,
                  cursor: "pointer",
                }}
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={() => setDecision("rejected")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  border: `1px solid ${decision === "rejected" ? D.red : D.line}`,
                  borderRadius: 5,
                  background: decision === "rejected" ? "#FEE2E2" : D.canvas,
                  fontSize: 11,
                  fontWeight: 600,
                  color: decision === "rejected" ? D.red : D.sub,
                  cursor: "pointer",
                }}
              >
                ✗ Reject
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add notes (required if rejecting)…"
              style={{
                width: "100%",
                minHeight: 50,
                padding: "6px 8px",
                border: `1px solid ${D.line}`,
                borderRadius: 4,
                fontSize: 10.5,
                fontFamily: D.font,
                resize: "vertical",
              }}
            />
            {error && (
              <div
                role="alert"
                style={{
                  fontSize: 10.5,
                  color: D.red,
                  background: `${D.red}0D`,
                  border: `1px solid ${D.red}28`,
                  borderRadius: 4,
                  padding: "6px 8px",
                }}
              >
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!decision || submitting}
              style={{
                padding: "6px 0",
                border: "none",
                borderRadius: 5,
                background: D.blue,
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: decision && !submitting ? "pointer" : "default",
                opacity: decision && !submitting ? 1 : 0.5,
              }}
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        )
      )}

      {/* Tiến độ hội đồng + phiếu của HR */}
      {reviewStatus && (
        <div style={{ marginTop: 10, fontSize: 10.5, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: D.muted }}>Your decision:</span>
            <span
              style={{
                fontWeight: 600,
                color: myDecision === "approved" ? D.mint : myDecision === "rejected" ? D.red : D.dim,
              }}
            >
              {myDecision === "pending" ? "Not submitted" : myDecision === "approved" ? "Approved" : "Rejected"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: D.muted }}>Tech Lead panel:</span>
            <span
              title={reviewStatus.panel_rule}
              style={{
                fontWeight: 600,
                fontFamily: D.mono,
                color:
                  reviewStatus.approved_tls >= reviewStatus.required_tl_approvals
                    ? D.mint
                    : D.sub,
              }}
            >
              {reviewStatus.approved_tls}/{reviewStatus.required_tl_approvals} approved
              {reviewStatus.rejected_tls > 0 && ` · ${reviewStatus.rejected_tls} rejected`}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: D.muted }}>HR:</span>
            <span
              style={{
                fontWeight: 600,
                color:
                  reviewStatus.hr_decision === "approved"
                    ? D.mint
                    : reviewStatus.hr_decision === "rejected"
                      ? D.red
                      : D.dim,
              }}
            >
              {reviewStatus.hr_decision === "pending"
                ? "Waiting…"
                : reviewStatus.hr_decision === "approved"
                  ? "Approved"
                  : "Rejected"}
            </span>
          </div>
        </div>
      )}

      {/* Ghi chú từng Tech Lead — HR cần đọc lý do trước khi chốt. */}
      {reviewStatus?.tl_reviews
        .filter((r) => r.review_text)
        .map((r) => (
          <div
            key={r.reviewer_id}
            style={{
              marginTop: 6,
              fontSize: 10,
              color: D.muted,
              padding: "5px 8px",
              background: D.canvas,
              borderRadius: 4,
              border: `1px solid ${D.line}`,
            }}
          >
            <strong style={{ color: r.decision === "approved" ? D.mint : D.red }}>
              {r.decision === "approved" ? "✓" : "✗"} Tech Lead
            </strong>{" "}
            {r.review_text}
          </div>
        ))}

      {reviewStatus?.hr_review_text && reviewStatus.hr_decision !== "pending" && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: D.muted,
            padding: "5px 8px",
            background: D.canvas,
            borderRadius: 4,
            border: `1px solid ${D.line}`,
          }}
        >
          <strong>HR&apos;s notes:</strong> {reviewStatus.hr_review_text}
        </div>
      )}

      {reviewStatus?.panel_rule && (
        <div style={{ marginTop: 8, fontSize: 9.5, color: D.dim, textAlign: "center" }}>
          {reviewStatus.panel_rule}
        </div>
      )}

      {status === "waiting_for_tls" && statusLine(D.amber, "⏳ Waiting for the Tech Lead panel…")}
      {status === "waiting_for_hr" && statusLine(D.amber, "⚠️ Tech Leads approved — waiting for HR")}
      {status === "ready_to_schedule" && statusLine(D.mint, "✅ Approved — ready to schedule")}
      {status === "rejected_by_tls" && statusLine(D.red, "❌ Rejected by the Tech Lead panel")}
      {status === "rejected_by_hr" && statusLine(D.red, "❌ Rejected by HR — notification sent")}
    </div>
  );
}
