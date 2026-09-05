import React from "react";
import { Linkedin, CheckCircle2, ChevronDown, Briefcase, ExternalLink } from "lucide-react";
import { D, Dot, Badge, tint } from "@/lib/shared";
import { useT } from "@/lib/i18n";
import type { LinkedinProfile } from "../types";

// ─── LinkedIn Accordion Card ──────────────────────────────────────────────────
export function LinkedInCard({
  expanded,
  onToggle,
  data,
  linkedinUrl,
}: {
  expanded: boolean;
  onToggle: () => void;
  data: LinkedinProfile | null;
  linkedinUrl: string | null;
}) {
  const t = useT();
  const experiences = data?.experiences || [];
  const fullName = data?.full_name || "Candidate";
  const profileUrl = data?.profile_url || linkedinUrl;

  return (
    <div
      style={{
        border: `1px solid ${D.line}`,
        borderRadius: 8,
        overflow: "visible",
        background: D.canvas,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: expanded ? `1px solid ${D.line}` : "none",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: "#0A66C2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Linkedin size={14} strokeWidth={1.5} color="#fff" fill="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 1,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: D.ink }}>
              LinkedIn
            </span>
            <Badge color={D.mint} bg={D.mintSoft}>
              <Dot color={D.mint} />
              {t("candidate.connected")}
            </Badge>
          </div>
          <span
            style={{
              fontSize: 10.5,
              color: "#0A66C2",
              fontFamily: D.mono,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {profileUrl
              ? profileUrl.replace("https://", "").replace("http://", "")
              : t("candidate.linkedin.unavailable")}{" "}
            <ExternalLink size={9} strokeWidth={2} color="#0A66C2" />
          </span>
        </div>
        <ChevronDown
          size={13}
          strokeWidth={2}
          color={D.muted}
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </div>
      {expanded && (
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            animation: "fadeSlideIn 0.2s ease both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 13px",
              borderRadius: 6,
              background: D.mintSoft,
              border: `1px solid ${tint("mint", "28")}`,
            }}
          >
            <CheckCircle2 size={16} strokeWidth={1.8} color={D.mint} />
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: D.ink,
                  lineHeight: 1.2,
                }}
              >
                {t("candidate.linkedin.verifiedHistory")}
              </div>
              <div style={{ fontSize: 10.5, color: D.sub, lineHeight: 1.4 }}>
                {experiences.length > 0
                  ? t("candidate.linkedin.rolesMapped", { n: experiences.length })
                  : t("candidate.linkedin.noHistory")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: D.muted,
              }}
            >
              {t("candidate.linkedin.profileInfo")}
            </div>
            {data?.full_name && (
              <div style={{ fontSize: 11, color: D.sub }}>
                <span style={{ fontWeight: 600, color: D.ink }}>{t("candidate.linkedin.name")}</span>{" "}
                {data.full_name}
              </div>
            )}
            {data?.headline && (
              <div style={{ fontSize: 10.5, color: D.muted, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600, color: D.sub }}>{t("candidate.linkedin.headline")}</span>{" "}
                {data.headline}
              </div>
            )}
          </div>
          {experiences.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: D.muted,
                }}
              >
                {t("candidate.linkedin.workExperience")}
              </div>
              {experiences.map((role, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 5,
                    background: D.surface,
                    border: `1px solid ${D.lineSoft}`,
                  }}
                >
                  <Briefcase size={11} strokeWidth={1.8} color={D.muted} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: D.ink,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {role.title}
                    </div>
                    <div style={{ fontSize: 9.5, color: D.muted }}>
                      {role.company}
                    </div>
                  </div>
                  {role.is_current && (
                    <Badge color={D.blue} bg={D.blueSoft}>
                      {t("candidate.linkedin.current")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
