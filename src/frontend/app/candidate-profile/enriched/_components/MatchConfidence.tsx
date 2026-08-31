import React from "react";
import { TrendingUp } from "lucide-react";
import { D } from "@/lib/shared";
import type { MockAnalytics } from "../types";

// ─── Match Confidence (enriched) ───────────────────────────────────────────────
export function MatchConfidence({ analytics }: { analytics: MockAnalytics | null }) {
  const score = analytics?.match_confidence_score || 89.5;
  const scoreIncrease = analytics?.score_increase || 2.1;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 8,
        background: `linear-gradient(145deg, ${D.blue}0A 0%, ${D.canvas} 60%)`,
        border: `1px solid ${D.blue}28`,
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={D.line}
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={D.blue}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            strokeDashoffset={circ / 4}
          />
          <text
            x="50"
            y="44"
            textAnchor="middle"
            fontSize="16"
            fontWeight="800"
            fill={D.ink}
            fontFamily="'Inter', sans-serif"
            letterSpacing="-0.05em"
          >
            {score}
          </text>
          <text
            x="50"
            y="57"
            textAnchor="middle"
            fontSize="9"
            fill={D.muted}
            fontFamily="'Inter', sans-serif"
          >
            / 100
          </text>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: D.muted,
            marginBottom: 4,
          }}
        >
          Match Confidence
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: D.ink,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginBottom: 5,
          }}
        >
          {score}{" "}
          <span style={{ fontSize: 14, color: D.muted, fontWeight: 400 }}>
            / 100
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 8px",
            borderRadius: 5,
            background: D.mintSoft,
            border: `1px solid ${D.mint}28`,
            marginBottom: 10,
          }}
        >
          <TrendingUp size={10} strokeWidth={2} color={D.mint} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: D.mint }}>
            +{scoreIncrease} increase from external data enrichment
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "Experience Fit", pct: 93 },
            { label: "Skills Alignment", pct: 87 },
            { label: "Culture Signal", pct: 81 },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: D.muted,
                  width: 96,
                  flexShrink: 0,
                }}
              >
                {item.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  background: D.line,
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${item.pct}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${D.blue}, ${D.blueDeep})`,
                    borderRadius: 99,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 9.5,
                  fontFamily: D.mono,
                  fontWeight: 600,
                  color: D.sub,
                  width: 28,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {item.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
