"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Users, X } from "lucide-react";
import { D } from "../lib/shared";
import {
  getPanel,
  invitePanelMember,
  listAvailableReviewers,
  removePanelMember,
  type PanelMember,
} from "../services/panelService";

/**
 * HR chọn Tech Lead vào hội đồng chấm của một tin tuyển dụng.
 *
 * Hội đồng quyết định hai thứ: ai được XEM hồ sơ ứng tuyển vào tin này (hồ sơ
 * chứa PII, nên đây là ranh giới bảo mật), và mẫu số của ngưỡng duyệt 80%.
 *
 * Vì vậy component báo cả sĩ số lẫn số phiếu cần — HR đang quyết định một con
 * số, không chỉ đang thêm tên vào danh sách.
 */
export function ReviewPanelPicker({
  jobPostingId,
  onCountChange,
}: {
  /** `null` khi tin chưa được lưu lần nào — chưa có gì để gắn hội đồng vào. */
  jobPostingId: string | null;
  onCountChange?: (count: number) => void;
}) {
  const [panel, setPanel] = useState<PanelMember[]>([]);
  const [available, setAvailable] = useState<PanelMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback(
    (members: PanelMember[]) => {
      setPanel(members);
      onCountChange?.(members.length);
    },
    [onCountChange],
  );

  useEffect(() => {
    if (!jobPostingId) {
      publish([]);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([getPanel(jobPostingId), listAvailableReviewers()])
      .then(([members, all]) => {
        if (!alive) return;
        publish(members);
        setAvailable(all);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load the panel."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [jobPostingId, publish]);

  const act = async (id: string, run: () => Promise<PanelMember[]>) => {
    setBusyId(id);
    setError(null);
    try {
      publish(await run());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That change did not go through.");
    } finally {
      setBusyId(null);
    }
  };

  const inPanel = new Set(panel.map((m) => m.reviewer_id));
  const invitable = available.filter((m) => !inPanel.has(m.reviewer_id));
  // Khớp với review/domain/policy.py — nhưng chỉ để xem trước; con số thật do
  // backend tính và trả về cùng trạng thái review.
  const needed = panel.length === 0 ? 0 : Math.ceil(panel.length * 0.8);

  const card: React.CSSProperties = {
    border: `1px solid ${D.line}`,
    borderRadius: 8,
    background: D.canvas,
    padding: 16,
  };

  if (!jobPostingId) {
    return (
      <div style={{ ...card, color: D.muted, fontSize: 12.5 }}>
        Save this posting first, then choose who reviews the applications.
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Users size={15} strokeWidth={1.8} color={D.blue} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: D.ink }}>Review panel</span>
      </div>

      <p style={{ fontSize: 12, color: D.sub, lineHeight: 1.6, margin: "0 0 12px" }}>
        Only these Tech Leads can open applications for this posting, and{" "}
        <strong style={{ color: D.ink }}>
          {needed > 0 ? `${needed} of ${panel.length}` : "none of them"}
        </strong>{" "}
        must approve before it reaches HR.
      </p>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.muted, fontSize: 12 }}>
          <Loader2 size={14} className="animate-spin" /> Loading panel…
        </div>
      ) : (
        <>
          {panel.length === 0 && (
            <div
              role="alert"
              style={{
                padding: "8px 10px",
                borderRadius: 5,
                background: `${D.amber}0D`,
                border: `1px solid ${D.amber}33`,
                color: D.amber,
                fontSize: 11.5,
                marginBottom: 10,
              }}
            >
              No reviewers yet — this posting cannot be published, and any application
              to it would sit unreviewed.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {panel.map((m) => (
              <div
                key={m.reviewer_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: D.surface,
                  border: `1px solid ${D.lineSoft}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: D.ink }}>{m.name}</div>
                  <div style={{ fontSize: 10.5, color: D.muted }}>{m.email}</div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  disabled={busyId === m.reviewer_id}
                  onClick={() =>
                    act(m.reviewer_id, () => removePanelMember(jobPostingId, m.reviewer_id))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: busyId === m.reviewer_id ? "default" : "pointer",
                    color: D.muted,
                    padding: 2,
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          {invitable.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {invitable.map((m) => (
                <button
                  key={m.reviewer_id}
                  type="button"
                  disabled={busyId === m.reviewer_id}
                  onClick={() =>
                    act(m.reviewer_id, () => invitePanelMember(jobPostingId, m.reviewer_id))
                  }
                  title={m.email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    borderRadius: 99,
                    border: `1px dashed ${D.line}`,
                    background: "transparent",
                    color: D.sub,
                    fontSize: 11.5,
                    cursor: busyId === m.reviewer_id ? "default" : "pointer",
                  }}
                >
                  <Plus size={11} strokeWidth={2} />
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {invitable.length === 0 && panel.length > 0 && (
            <div style={{ fontSize: 11, color: D.dim }}>Every Tech Lead is on this panel.</div>
          )}
        </>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: "7px 9px",
            borderRadius: 5,
            background: `${D.red}0D`,
            border: `1px solid ${D.red}28`,
            color: D.red,
            fontSize: 11.5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
