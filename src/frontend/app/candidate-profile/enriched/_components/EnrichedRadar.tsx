"use client";

import React, { useState } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { D } from "@/lib/shared";
import type { MockAnalytics } from "../types";

// ─── Enriched Radar Chart ──────────────────────────────────────────────────────
export function EnrichedRadar({ analytics }: { analytics: MockAnalytics | null }) {
  const [showBoth, setShowBoth] = useState(true);

  const skillNames = ["Backend", "Frontend", "Cloud Dev", "InfoSec", "ML / AI"];
  const preData = analytics?.technical_skill_matrix.pre_enrichment || [
    55, 52, 48, 45, 50,
  ];
  const postData = analytics?.technical_skill_matrix.post_enrichment || [
    72, 70, 66, 58, 64,
  ];

  const data = skillNames.map((skill, i) => ({
    skill,
    "Pre-Enrichment": Math.max(0, Math.min(100, Math.round(preData[i] ?? 0))),
    "Post-Enrichment": Math.max(0, Math.min(100, Math.round(postData[i] ?? 0))),
    fullMark: 100,
  }));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: D.ink,
              letterSpacing: "-0.02em",
              marginBottom: 2,
            }}
          >
            Technical Skill Matrix
          </div>
          <div style={{ fontSize: 10.5, color: D.muted }}>
            Multi-axis competency · enriched with external repository data
          </div>
        </div>
        <button
          onClick={() => setShowBoth(!showBoth)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            border: `1px solid ${showBoth ? `${D.blue}30` : D.line}`,
            borderRadius: 5,
            background: showBoth ? D.blueSoft : D.canvas,
            cursor: "pointer",
            fontSize: 10.5,
            color: showBoth ? D.blue : D.sub,
            fontFamily: D.font,
            fontWeight: showBoth ? 600 : 400,
            transition: "all 0.15s ease",
          }}
        >
          <TrendingUp
            size={10}
            strokeWidth={2}
            color={showBoth ? D.blue : D.muted}
          />
          Show delta
        </button>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            margin={{ top: 8, right: 36, bottom: 8, left: 36 }}
          >
            <PolarGrid stroke={D.line} strokeWidth={0.75} />
            <PolarAngleAxis
              dataKey="skill"
              tick={{
                fontSize: 10,
                fill: D.sub,
                fontFamily: D.font,
                fontWeight: 500,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              key="pre"
              name="Pre-Enrichment"
              dataKey="Pre-Enrichment"
              stroke={showBoth ? D.line : "transparent"}
              strokeWidth={1.5}
              fill={showBoth ? D.muted : "transparent"}
              fillOpacity={showBoth ? 0.07 : 0}
              strokeDasharray="4 2"
            />
            <Radar
              key="post"
              name="Post-Enrichment"
              dataKey="Post-Enrichment"
              stroke={D.blue}
              strokeWidth={1.75}
              fill={D.blue}
              fillOpacity={0.15}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as {
                  skill: string;
                  "Pre-Enrichment": number;
                  "Post-Enrichment": number;
                };
                return (
                  <div
                    style={{
                      background: D.ink,
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: D.font,
                      minWidth: 130,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 5 }}>
                      {d.skill}
                    </div>
                    {showBoth && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 3,
                          color: D.dim,
                        }}
                      >
                        <span>Baseline</span>
                        <span style={{ fontFamily: D.mono }}>
                          {d["Pre-Enrichment"]}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        color: "#93C5FD",
                      }}
                    >
                      <span>Enriched</span>
                      <span style={{ fontFamily: D.mono, fontWeight: 600 }}>
                        {d["Post-Enrichment"]}
                      </span>
                    </div>
                    {showBoth && (
                      <div
                        style={{
                          marginTop: 5,
                          paddingTop: 5,
                          borderTop: "1px solid rgba(255,255,255,0.1)",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          color: "#6EE7B7",
                          fontWeight: 600,
                        }}
                      >
                        <span>Delta</span>
                        <span style={{ fontFamily: D.mono }}>
                          +{d["Post-Enrichment"] - d["Pre-Enrichment"]}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {showBoth && (
        <div
          style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 16,
                height: 1.5,
                borderTop: "1.5px dashed #9CA3AF",
              }}
            />
            <span style={{ color: D.muted }}>Pre-enrichment</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 16,
                height: 2,
                background: D.blue,
                borderRadius: 1,
              }}
            />
            <span style={{ color: D.sub }}>Post-enrichment</span>
          </div>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "0 10px",
        }}
      >
        {data.map((s) => (
          <div key={s.skill}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                fontFamily: D.mono,
                color: D.ink,
                marginBottom: 3,
              }}
            >
              {s["Post-Enrichment"]}
              {s["Post-Enrichment"] > s["Pre-Enrichment"] && (
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 600,
                    color: D.mint,
                    marginLeft: 3,
                  }}
                >
                  +{s["Post-Enrichment"] - s["Pre-Enrichment"]}
                </span>
              )}
            </div>
            <div
              style={{
                height: 2.5,
                background: D.line,
                borderRadius: 99,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${s["Post-Enrichment"]}%`,
                  background: D.blue,
                  borderRadius: 99,
                }}
              />
            </div>
            <div style={{ fontSize: 9, color: D.muted, marginTop: 3 }}>
              {s.skill}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
