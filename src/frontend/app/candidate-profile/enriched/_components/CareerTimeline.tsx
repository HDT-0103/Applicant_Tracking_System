"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronDown, Briefcase, GraduationCap } from "lucide-react";
import { D, Badge } from "@/lib/shared";
import { experiencesToTimelineItems } from "../_lib/timeline";
import type { EnrichedProfile } from "../types";

// ─── Career Timeline (verified) ─────────────────────────────────────────────────
export function CareerTimeline({ data }: { data: EnrichedProfile | null }) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  // Convert real LinkedIn data to timeline items
  const timelineItems = data?.linkedin
    ? experiencesToTimelineItems(
        data.linkedin.experiences,
        data.linkedin.educations,
      )
    : [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: D.ink,
              letterSpacing: "-0.02em",
            }}
          >
            Career Trajectory
          </div>
          <div style={{ fontSize: 10.5, color: D.muted, marginTop: 1 }}>
            Verified chronological milestones · LinkedIn cross-referenced
          </div>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={2}
          color={D.muted}
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </div>
      {expanded && (
        <div style={{ position: "relative" }}>
          {timelineItems.length > 0 ? (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 44,
                  top: 6,
                  bottom: 6,
                  width: 1,
                  background: D.line,
                }}
              />
              {timelineItems.map((item, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    marginBottom: i < timelineItems.length - 1 ? 8 : 0,
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      flexShrink: 0,
                      textAlign: "right",
                      paddingTop: 4,
                      fontSize: 9.5,
                      fontWeight: item.current ? 700 : 500,
                      color: item.current ? D.blue : D.dim,
                      fontFamily: D.mono,
                    }}
                  >
                    {item.year}
                  </div>
                  <div
                    style={{
                      width: 18,
                      flexShrink: 0,
                      display: "flex",
                      justifyContent: "center",
                      paddingTop: 6,
                      position: "relative",
                      zIndex: 1,
                      marginLeft: -1,
                    }}
                  >
                    <div
                      style={{
                        width: item.current ? 9 : 7,
                        height: item.current ? 9 : 7,
                        borderRadius: "50%",
                        background: item.current
                          ? D.blue
                          : item.type === "edu"
                            ? D.purple
                            : item.verified
                              ? D.mint
                              : D.dim,
                        border: `2px solid ${item.current ? D.blue : item.type === "edu" ? D.purple : item.verified ? D.mint : D.line}`,
                        transition: "transform 0.12s",
                        transform: hovered === i ? "scale(1.5)" : "scale(1)",
                        boxShadow: item.current
                          ? `0 0 0 3px ${D.blue}18`
                          : undefined,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: "4px 10px 8px",
                      marginLeft: 4,
                      borderRadius: 6,
                      background: hovered === i ? D.surface : "transparent",
                      border: `1px solid ${hovered === i ? D.line : "transparent"}`,
                      transition: "all 0.15s ease",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        flexWrap: "wrap",
                        marginBottom: 1,
                      }}
                    >
                      {item.type === "work" ? (
                        <Briefcase
                          size={9.5}
                          strokeWidth={2}
                          color={item.current ? D.blue : D.muted}
                        />
                      ) : (
                        <GraduationCap
                          size={9.5}
                          strokeWidth={2}
                          color={D.purple}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: D.ink,
                        }}
                      >
                        {item.title}
                      </span>
                      {item.current && (
                        <Badge color={D.blue} bg={D.blueSoft}>
                          NOW
                        </Badge>
                      )}
                      {item.type === "edu" && (
                        <Badge color={D.purple} bg={`${D.purple}10`}>
                          EDU
                        </Badge>
                      )}
                      {item.verified && (
                        <Badge color={D.mint} bg={D.mintSoft}>
                          <CheckCircle2
                            size={8}
                            strokeWidth={2}
                            color={D.mint}
                          />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: D.sub, marginBottom: 1 }}
                    >
                      {item.org}
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: D.dim,
                        fontFamily: D.mono,
                        marginBottom: 3,
                      }}
                    >
                      {item.period}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: D.muted,
                        lineHeight: 1.45,
                      }}
                    >
                      {item.note}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 6,
                background: D.surface,
                border: `1px dashed ${D.line}`,
                fontSize: 10.5,
                color: D.muted,
                textAlign: "center",
              }}
            >
              No career trajectory data available from LinkedIn enrichment
            </div>
          )}
        </div>
      )}
    </div>
  );
}
