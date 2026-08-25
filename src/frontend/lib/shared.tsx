import React from "react";

// --- Design Tokens ------------------------------------------------------------
// Token đã chuyển sang ./tokens. Vừa import để dùng trong file này, vừa
// re-export để 995 chỗ đang `import { D } from ".../lib/shared"` không phải sửa.
import { D } from "./tokens";

export { D };

// --- Shared Data --------------------------------------------------------------

export const radarBase = [
  { skill: "Backend", base: 76, enriched: 88 },
  { skill: "Frontend", base: 72, enriched: 84 },
  { skill: "Cloud", base: 68, enriched: 82 },
  { skill: "Data", base: 70, enriched: 85 },
  { skill: "DevOps", base: 66, enriched: 80 },
];

export const timelineItems = [
  {
    year: "2026",
    type: "work",
    title: "Senior Software Engineer",
    org: "SmartATS",
    period: "2026 - Present",
    note: "Leading ingestion pipeline and ML enrichment improvements.",
    verified: true,
    current: true,
  },
  {
    year: "2024",
    type: "work",
    title: "Software Engineer",
    org: "TechNova",
    period: "2024 - 2026",
    note: "Built scalable APIs and analytics dashboards for hiring teams.",
    verified: true,
    current: false,
  },
  {
    year: "2022",
    type: "edu",
    title: "B.Sc. Computer Science",
    org: "University of Science",
    period: "2018 - 2022",
    note: "Focused on distributed systems and data engineering.",
    verified: true,
    current: false,
  },
];

// --- Components ---------------------------------------------------------------

export function Dot({
  color = D.mint,
  pulse = false,
}: {
  color?: string;
  pulse?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        animation: pulse ? "livePulse 2.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

export function Badge({
  children,
  color = D.mint,
  bg,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color,
        background: bg ?? `${color}14`,
        border: `1px solid ${color}28`,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        fontFamily: D.font,
      }}
    >
      {children}
    </span>
  );
}

export function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: D.muted,
        marginBottom: 12,
        fontFamily: D.font,
      }}
    >
      {children}
    </div>
  );
}

export function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: D.line,
        margin: "20px 0",
      }}
    />
  );
}

// --- Global Styles ------------------------------------------------------------

// Không còn `@import` Google Fonts ở đây. `@import` trong CSS chặn render cho
// tới khi tải xong, và nó nằm trong chuỗi JS nên trình duyệt chỉ thấy được sau
// khi bundle chạy — chậm nhất trong mọi cách nạp font. Inter nay do next/font
// lo (tự host, không gọi ra ngoài lúc chạy), xem app/layout.tsx.
export const globalStyles = `
body {
  margin: 0;
  font-family: ${D.font};
  background: ${D.bg};
  color: ${D.ink};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

@keyframes livePulse {
  0% {
    box-shadow: 0 0 0 0 ${D.mint}40;
  }
  70% {
    box-shadow: 0 0 0 4px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes skelShimmer {
  0%, 100% { opacity: 1; } 50% { opacity: 0.45; }
}
`;