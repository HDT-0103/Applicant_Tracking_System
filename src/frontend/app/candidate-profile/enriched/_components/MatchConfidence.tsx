import React from "react";
import { TrendingUp } from "lucide-react";
import { D, tint } from "@/lib/shared";
import { useT } from "@/lib/i18n";
import type { MockAnalytics } from "../types";

/**
 * Điểm khớp của ứng viên — cùng con số với "Khớp x%" trên dashboard.
 *
 * Con số đến từ `enrichment_profiles.match_confidence_score`, và có HAI nguồn:
 * pipeline CV (cosine giữa CV và tin tuyển dụng, đi kèm bảng đối chiếu
 * must-have) hoặc, khi hồ sơ chưa qua pipeline, tín hiệu đếm từ khoá từ
 * GitHub/LinkedIn (không nhìn tin nào, hay chạm trần 99). Nhãn dưới điểm nói
 * rõ đang xem nguồn nào.
 *
 * Không có điểm thì nói "chưa chấm". Bản trước rơi về 89.5 và vẽ ba thanh
 * "Phù hợp kinh nghiệm 93% / Khớp kỹ năng 87% / Tín hiệu văn hoá 81%" cứng
 * cho mọi ứng viên — số bịa trên màn hình ra quyết định.
 */
type Coverage = { matched: number; total: number };

function coverageOf(matrix: unknown, key: "must_have" | "nice_to_have"): Coverage | null {
  if (!matrix || typeof matrix !== "object") return null;
  const bucket = (matrix as Record<string, unknown>)[key];
  if (!bucket || typeof bucket !== "object") return null;
  const { matched, missing } = bucket as { matched?: unknown; missing?: unknown };
  if (!Array.isArray(matched) || !Array.isArray(missing)) return null;
  const total = matched.length + missing.length;
  return total > 0 ? { matched: matched.length, total } : null;
}

export function isJobRelativeScore(matrix: unknown): boolean {
  return Boolean(matrix && typeof matrix === "object" && "must_have" in (matrix as object));
}

export function MatchConfidence({
  analytics,
  skillMatrix,
}: {
  analytics: MockAnalytics | null;
  skillMatrix?: unknown;
}) {
  const t = useT();
  const score = typeof analytics?.match_confidence_score === "number" ? analytics.match_confidence_score : null;
  const increase = typeof analytics?.score_increase === "number" && analytics.score_increase > 0 ? analytics.score_increase : null;
  const jobRelative = isJobRelativeScore(skillMatrix);
  const bars = [
    { label: t("candidate.match.mustHave"), coverage: coverageOf(skillMatrix, "must_have") },
    { label: t("candidate.match.niceToHave"), coverage: coverageOf(skillMatrix, "nice_to_have") },
  ].filter((b): b is { label: string; coverage: Coverage } => b.coverage !== null);
  const r = 44;
  const circ = 2 * Math.PI * r;
  const fill = score === null ? 0 : (Math.min(score, 100) / 100) * circ;
  const shown = score === null ? "–" : Math.round(score);

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 8,
        background: `linear-gradient(145deg, ${tint("blue", "0A")} 0%, ${D.canvas} 60%)`,
        border: `1px solid ${tint("blue", "28")}`,
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label={t("candidate.match.title")}>
          <circle cx="50" cy="50" r={r} fill="none" stroke={D.line} strokeWidth="6" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={D.blue} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`} strokeDashoffset={circ / 4}
          />
          <text x="50" y="44" textAnchor="middle" fontSize="16" fontWeight="800" fill={D.ink} fontFamily="'Inter', sans-serif" letterSpacing="-0.05em">
            {shown}
          </text>
          <text x="50" y="57" textAnchor="middle" fontSize="9" fill={D.muted} fontFamily="'Inter', sans-serif">
            / 100
          </text>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.muted, marginBottom: 4 }}>
          {t("candidate.match.title")}
        </div>
        {score === null ? (
          <div style={{ fontSize: 13, color: D.muted, marginBottom: 6 }}>{t("candidate.match.unscored")}</div>
        ) : (
          <div style={{ fontSize: 28, fontWeight: 800, color: D.ink, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 5 }}>
            {shown}{" "}
            <span style={{ fontSize: 14, color: D.muted, fontWeight: 400 }}>/ 100</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: D.muted, marginBottom: 8 }}>
          {jobRelative ? t("candidate.match.sourceJob") : t("candidate.match.sourceSignals")}
        </div>
        {increase !== null && (
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 5,
              background: D.mintSoft, border: `1px solid ${tint("mint", "28")}`, marginBottom: 10,
            }}
          >
            <TrendingUp size={10} strokeWidth={2} color={D.mint} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: D.mint }}>
              {t("candidate.match.increase", { n: increase })}
            </span>
          </div>
        )}
        {bars.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {bars.map((item) => {
              const pct = Math.round((item.coverage.matched / item.coverage.total) * 100);
              return (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: D.muted, width: 96, flexShrink: 0 }}>{item.label}</span>
                  <div style={{ flex: 1, height: 3, background: D.line, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${D.blue}, ${D.blueDeep})`, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 9.5, fontFamily: D.mono, fontWeight: 600, color: D.sub, width: 40, textAlign: "right", flexShrink: 0 }}>
                    {item.coverage.matched}/{item.coverage.total}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
