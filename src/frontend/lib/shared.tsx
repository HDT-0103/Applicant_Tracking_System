import React from "react";

// --- Design Tokens ------------------------------------------------------------
export const D = {
  bg: "#F4F5F7",
  canvas: "#FFFFFF",
  surface: "#FAFBFC",
  ink: "#0D1117",
  sub: "#3D4451",
  muted: "#6B7280",
  dim: "#9CA3AF",
  line: "#E2E4E9",
  lineSoft: "#ECEEF2",
  blue: "#1B62F0",
  blueSoft: "rgba(27,98,240,0.09)",
  blueMid: "rgba(27,98,240,0.18)",
  mint: "#0D9E6F",
  mintSoft: "rgba(13,158,111,0.10)",
  purple: "#7C3AED",
  amber: "#D97706",
  red: "#DC2626",
  font: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
};

// --- Shared Data --------------------------------------------------------------

export const radarBase = [
  { skill: "Backend", base: 86, enriched: 91, fullMark: 100 },
  { skill: "Frontend", base: 60, enriched: 63, fullMark: 100 },
  { skill: "Cloud", base: 73, enriched: 79, fullMark: 100 },
  { skill: "InfoSec", base: 52, enriched: 55, fullMark: 100 },
  { skill: "ML / AI", base: 69, enriched: 74, fullMark: 100 },
];

export const timelineItems = [
  {
    year: "2024",
    title: "Senior Backend Engineer",
    org: "Nexus Systems Ltd.",
    period: "Jan 2024 — Present",
    type: "work" as const,
    current: true,
    note: "Microservices · 2M+ req/day · P95 latency −43%",
    verified: true,
  },
  {
    year: "2022",
    title: "Backend Engineer",
    org: "DataBridge Inc.",
    period: "Mar 2022 — Dec 2023",
    type: "work" as const,
    current: false,
    note: "Apache Spark · 500 GB/day throughput",
    verified: true,
  },
  {
    year: "2020",
    title: "Junior Software Developer",
    org: "TechStack Labs",
    period: "Jun 2020 — Feb 2022",
    type: "work" as const,
    current: false,
    note: "FastAPI · Node.js · REST API design · 80K DAU",
    verified: true,
  },
  {
    year: "2018",
    title: "Software Engineering Intern",
    org: "CloudBase Corp.",
    period: "May 2018 — Aug 2018",
    type: "work" as const,
    current: false,
    note: "Docker · Jenkins CI/CD",
    verified: false,
  },
  {
    year: "2014",
    title: "B.Sc. Computer Science",
    org: "University of Science & Technology",
    period: "2014 — 2018",
    type: "edu" as const,
    current: false,
    note: "GPA 3.87 · Dean's List · Distributed Systems thesis",
    verified: true,
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

export const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

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