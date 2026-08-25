"use client";

import React, { useState } from "react";
import { D, SectionLabel } from "@/lib/shared";
import { submitReview, resolveConflict, type ReviewStatus, type ReviewDecision } from "@/services/reviewService";

// ─── Review Panel ──────────────────────────────────────────────────────────────
export function ReviewPanel({
  candidateUuid,
  userRole,
  reviewStatus,
  onRefresh,
}: {
  candidateUuid: string;
  userRole: string;
  reviewStatus: ReviewStatus | null;
  onRefresh: () => void;
}) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolveDec, setResolveDec] = useState<ReviewDecision | null>(null);

  const myDecision =
    userRole === "hr" ? reviewStatus?.hr_decision : reviewStatus?.tl_decision;
  const otherLabel = userRole === "hr" ? "Tech Lead" : "HR";
  const otherDecision =
    userRole === "hr" ? reviewStatus?.tl_decision : reviewStatus?.hr_decision;
  const otherText =
    userRole === "hr"
      ? reviewStatus?.tl_review_text
      : reviewStatus?.hr_review_text;

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      await submitReview(candidateUuid, decision, text);
      onRefresh();
    } catch {
      /* ignore */
    }
    setSubmitting(false);
  };

  const handleResolve = async () => {
    if (!resolveDec) return;
    setSubmitting(true);
    try {
      await resolveConflict(candidateUuid, resolveDec);
      onRefresh();
    } catch {
      /* ignore */
    }
    setSubmitting(false);
  };

  const status = reviewStatus?.overall_status || "waiting";

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
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 5,
            border: `1px solid ${D.line}`,
            background: D.surface,
          }}
        >
          <div style={{ fontSize: 10, color: D.muted, textAlign: "center" }}>
            ⏳ Loading review status…
          </div>
        </div>
      ) : myDecision === "pending" &&
        userRole === "hr" &&
        reviewStatus.tl_decision === "pending" ? (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 5,
            border: `1px solid ${D.amber}30`,
            background: `${D.amber}08`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: D.amber,
              textAlign: "center",
            }}
          >
            ⏳ Tech Lead must submit their review first
          </div>
        </div>
      ) : (
        myDecision === "pending" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 8,
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <button
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
            <button
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

      {/* Status display */}
      <div
        style={{
          marginTop: 10,
          fontSize: 10.5,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: D.muted }}>Your decision:</span>
          <span
            style={{
              fontWeight: 600,
              color:
                myDecision === "approved"
                  ? D.mint
                  : myDecision === "rejected"
                    ? D.red
                    : D.dim,
            }}
          >
            {myDecision === "pending"
              ? "Not submitted"
              : myDecision === "approved"
                ? "Approved"
                : "Rejected"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: D.muted }}>{otherLabel}:</span>
          <span
            style={{
              fontWeight: 600,
              color:
                otherDecision === "approved"
                  ? D.mint
                  : otherDecision === "rejected"
                    ? D.red
                    : D.dim,
            }}
          >
            {otherDecision === "pending"
              ? "Waiting…"
              : otherDecision === "approved"
                ? "Approved"
                : "Rejected"}
          </span>
        </div>
      </div>

      {otherText && otherDecision !== "pending" && (
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
          <strong>{otherLabel}&apos;s notes:</strong> {otherText}
        </div>
      )}

      {/* Status alerts */}
      {status === "waiting" && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: D.amber,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          ⏳ Waiting for both reviewers to submit…
        </div>
      )}
      {status === "ready_to_schedule" && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: D.mint,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          ✅ Both approved — ready to schedule
        </div>
      )}
      {status === "rejected" && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: D.red,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          ❌ Both rejected — notification sent
        </div>
      )}

      {status === "conflict" && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            borderRadius: 5,
            border: `1px solid ${D.amber}30`,
            background: `${D.amber}08`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: D.amber,
              marginBottom: 6,
            }}
          >
            ⚠️ Split decision —{" "}
            {userRole === "hr" ? "you make the final call" : "waiting for HR"}
          </div>
          {userRole === "hr" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setResolveDec("approved")}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  border: `1px solid ${resolveDec === "approved" ? D.mint : D.line}`,
                  borderRadius: 4,
                  background: resolveDec === "approved" ? D.mintSoft : D.canvas,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: resolveDec === "approved" ? D.mint : D.sub,
                  cursor: "pointer",
                }}
              >
                Override Accept
              </button>
              <button
                onClick={() => setResolveDec("rejected")}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  border: `1px solid ${resolveDec === "rejected" ? D.red : D.line}`,
                  borderRadius: 4,
                  background: resolveDec === "rejected" ? "#FEE2E2" : D.canvas,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: resolveDec === "rejected" ? D.red : D.sub,
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
            </div>
          )}
          {userRole === "hr" && resolveDec && (
            <button
              onClick={handleResolve}
              disabled={submitting}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "5px 0",
                border: "none",
                borderRadius: 4,
                background: D.blue,
                color: "#fff",
                fontSize: 10.5,
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Confirm Final Decision"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
