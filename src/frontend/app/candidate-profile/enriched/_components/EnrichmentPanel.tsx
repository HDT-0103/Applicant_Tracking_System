"use client";

import React, { useState } from "react";
import { Zap, AlertCircle, Clock, Layers } from "lucide-react";
import { D, Badge, SectionLabel, Divider, tint } from "@/lib/shared";
import { useT } from "@/lib/i18n";
import { GitHubCard } from "./GitHubCard";
import { LinkedInCard } from "./LinkedInCard";
import type { EnrichedProfile } from "../types";

// ─── Left Panel — Enrichment Dashboard ────────────────────────────────────────
export function EnrichmentPanel({ data }: { data: EnrichedProfile | null }) {
  const t = useT();
  const [openCard, setOpenCard] = useState<"github" | "linkedin" | null>(
    "github",
  );
  const toggle = (card: "github" | "linkedin") =>
    setOpenCard((prev) => (prev === card ? null : card));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: D.bg,
        borderRight: `1px solid ${D.line}`,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          height: 38,
          background: D.canvas,
          borderBottom: `1px solid ${D.line}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <Layers size={13} strokeWidth={1.8} color={D.muted} />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: D.ink,
            letterSpacing: "-0.01em",
          }}
        >
          {t("candidate.enrichment.title")}
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Badge color={D.blue} bg={D.blueSoft}>
            <Zap size={8} strokeWidth={2} color={D.blue} />
            {t("candidate.enrichment.aiEnriched")}
          </Badge>
          <span
            style={{
              fontSize: 9,
              color: D.muted,
              fontFamily: D.mono,
              padding: "1px 5px",
              border: `1px solid ${D.line}`,
              borderRadius: 3,
              background: D.surface,
            }}
          >
            {t("candidate.enrichment.sourceCount")}
          </span>
        </div>
      </div>

      {/* Scrollable — clip + auto */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "visible",
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minHeight: 0,
        }}
      >
        {/* Identity stripe */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 8,
            background: D.canvas,
            border: `1px solid ${D.line}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${D.blue} 0%, ${D.blueDeep} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            AM
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: D.ink,
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              {t("candidate.enrichment.profileTitle")}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: D.muted,
                lineHeight: 1.4,
                marginTop: 1,
              }}
            >
              {t("candidate.enrichment.profileSubtitle")}
            </div>
          </div>
          <Badge color={D.blue} bg={D.blueSoft}>
            {t("candidate.enrichment.screening")}
          </Badge>
        </div>

        <SectionLabel>{t("candidate.enrichment.integrations")}</SectionLabel>

        <GitHubCard
          expanded={openCard === "github"}
          onToggle={() => toggle("github")}
          data={data?.github || null}
          githubUsername={data?.github_username || null}
        />
        <LinkedInCard
          expanded={openCard === "linkedin"}
          onToggle={() => toggle("linkedin")}
          data={data?.linkedin || null}
          linkedinUrl={data?.linkedin_url || null}
        />

        <Divider />

        {/* Sync status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 6,
            background: D.surface,
            border: `1px solid ${D.line}`,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: D.mint,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: D.sub, flex: 1 }}>
            <strong style={{ fontWeight: 600, color: D.ink }}>
              {t("candidate.enrichment.autoSync")}
            </strong>{" "}
            <span
              style={{
                fontFamily: D.mono,
                fontSize: 10.5,
                fontWeight: 600,
                color: D.mint,
              }}
            >
              {t("candidate.enrichment.syncState")}
            </span>
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <Clock size={10} strokeWidth={2} color={D.dim} />
            <span style={{ fontSize: 10, color: D.muted, fontFamily: D.mono }}>
              {t("candidate.enrichment.lastSync")}
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 5,
            background: `${tint("amber", "0B")}`,
            border: `1px solid ${tint("amber", "22")}`,
          }}
        >
          <AlertCircle
            size={11}
            strokeWidth={2}
            color={D.amber}
            style={{ marginTop: 0.5, flexShrink: 0 }}
          />
          <span style={{ fontSize: 10.5, color: D.sub, lineHeight: 1.5 }}>
            {t("candidate.enrichment.disclaimer")}
          </span>
        </div>
      </div>
    </div>
  );
}
