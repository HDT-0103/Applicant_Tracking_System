"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Github, Linkedin, CheckCircle2, ChevronDown, TrendingUp,
  BookOpen, Briefcase, GraduationCap, ExternalLink, Zap,
  AlertCircle, Clock, Layers, Shield, GitBranch, Cpu, Globe,
} from "lucide-react";
import { D, Dot, Badge, SectionLabel, Divider, radarBase, timelineItems } from "../../src/app/shared";

// ─── GitHub Accordion Card ────────────────────────────────────────────────────
function GitHubCard({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const langs = [
    { name: "Python",     pct: 48, color: "#3572A5" },
    { name: "Go",         pct: 29, color: "#00ADD8" },
    { name: "TypeScript", pct: 23, color: "#3178C6" },
  ];
  return (
    <div style={{ border: `1px solid ${D.line}`, borderRadius: 8, overflow: "hidden", background: D.canvas }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", padding: "12px 16px",
          borderBottom: expanded ? `1px solid ${D.line}` : "none",
          gap: 10, cursor: "pointer",
        }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 7, background: D.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Github size={15} strokeWidth={1.5} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: D.ink }}>GitHub</span>
            <Badge color={D.mint} bg={D.mintSoft}><Dot color={D.mint} />Connected</Badge>
          </div>
          <span style={{ fontSize: 10.5, color: D.blue, fontFamily: D.mono, display: "flex", alignItems: "center", gap: 4 }}>
            github.com/alexmr <ExternalLink size={9} strokeWidth={2} color={D.blue} />
          </span>
        </div>
        <ChevronDown size={13} strokeWidth={2} color={D.muted}
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease", flexShrink: 0 }} />
      </div>
      {expanded && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14, animation: "fadeSlideIn 0.2s ease both" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: "10px 12px", borderRadius: 6, background: D.surface, border: `1px solid ${D.lineSoft}` }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: D.muted, marginBottom: 4 }}>Public Repos Analyzed</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: D.ink, letterSpacing: "-0.04em", lineHeight: 1, fontFamily: D.mono }}>14</div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 6, background: D.surface, border: `1px solid ${D.lineSoft}` }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: D.muted, marginBottom: 6 }}>Top Languages</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {langs.map((lang) => (
                  <div key={lang.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: lang.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 500, color: D.sub, flex: 1 }}>{lang.name}</span>
                    <span style={{ fontSize: 9.5, color: D.muted, fontFamily: D.mono }}>{lang.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", height: 5, borderRadius: 99, overflow: "hidden", gap: 1.5 }}>
            {langs.map((lang) => (
              <div key={lang.name} style={{ flex: lang.pct, background: lang.color, borderRadius: 99 }} title={`${lang.name}: ${lang.pct}%`} />
            ))}
          </div>
          <div style={{
            padding: "11px 13px", borderRadius: 6,
            background: D.blueSoft, border: `1px solid ${D.blueMid}`,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: D.blue }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, paddingLeft: 2 }}>
              <BookOpen size={10} strokeWidth={2} color={D.blue} />
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: D.blue }}>Latest README.md Semantic Extraction</span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: D.sub, lineHeight: 1.55, paddingLeft: 2 }}>
              Corroborated skills in <strong style={{ color: D.blue, fontWeight: 600 }}>Distributed Systems</strong> and <strong style={{ color: D.blue, fontWeight: 600 }}>Cloud Architecture</strong> — referenced across 6 repositories with consistent depth indicators.
            </p>
            <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap", paddingLeft: 2 }}>
              {["microservices", "kafka", "distributed-consensus", "terraform", "k8s"].map((tag) => (
                <span key={tag} style={{ fontSize: 9.5, fontFamily: D.mono, padding: "1px 6px", borderRadius: 3, background: `${D.blue}12`, border: `1px solid ${D.blue}22`, color: D.blue }}>#{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LinkedIn Accordion Card ──────────────────────────────────────────────────
function LinkedInCard({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const roles = [
    { title: "Senior Backend Engineer", org: "Nexus Systems Ltd.", match: 98 },
    { title: "Backend Engineer",        org: "DataBridge Inc.",    match: 96 },
    { title: "Junior Developer",        org: "TechStack Labs",     match: 91 },
  ];
  return (
    <div style={{ border: `1px solid ${D.line}`, borderRadius: 8, overflow: "hidden", background: D.canvas }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", padding: "12px 16px",
          borderBottom: expanded ? `1px solid ${D.line}` : "none",
          gap: 10, cursor: "pointer",
        }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 7, background: "#0A66C2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Linkedin size={14} strokeWidth={1.5} color="#fff" fill="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: D.ink }}>LinkedIn</span>
            <Badge color={D.mint} bg={D.mintSoft}><Dot color={D.mint} />Synced</Badge>
          </div>
          <span style={{ fontSize: 10.5, color: "#0A66C2", fontFamily: D.mono, display: "flex", alignItems: "center", gap: 4 }}>
            linkedin.com/in/alex-m-richardson <ExternalLink size={9} strokeWidth={2} color="#0A66C2" />
          </span>
        </div>
        <ChevronDown size={13} strokeWidth={2} color={D.muted}
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease", flexShrink: 0 }} />
      </div>
      {expanded && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, animation: "fadeSlideIn 0.2s ease both" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 13px", borderRadius: 6, background: D.mintSoft, border: `1px solid ${D.mint}28`,
          }}>
            <CheckCircle2 size={16} strokeWidth={1.8} color={D.mint} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: D.ink, lineHeight: 1.2 }}>Verified Employment History</div>
              <div style={{ fontSize: 10.5, color: D.sub, lineHeight: 1.4 }}>3 Roles mapped with <strong style={{ color: D.mint }}>95% alignment</strong> to original CV</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: D.muted }}>Role Alignment Map</div>
            {roles.map((role, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: 5, background: D.surface, border: `1px solid ${D.lineSoft}`,
              }}>
                <Briefcase size={11} strokeWidth={1.8} color={D.muted} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: D.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role.title}</div>
                  <div style={{ fontSize: 9.5, color: D.muted }}>{role.org}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <div style={{ width: 40, height: 3, borderRadius: 99, background: D.line, overflow: "hidden" }}>
                    <div style={{ width: `${role.match}%`, height: "100%", background: role.match >= 95 ? D.mint : D.blue, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 9.5, fontFamily: D.mono, fontWeight: 600, color: role.match >= 95 ? D.mint : D.blue, minWidth: 28, textAlign: "right" }}>{role.match}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Left Panel — Enrichment Dashboard ───────────────────────────────────────
function EnrichmentPanel() {
  const [openCard, setOpenCard] = useState<"github" | "linkedin" | null>("github");
  const toggle = (card: "github" | "linkedin") =>
    setOpenCard((prev) => (prev === card ? null : card));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: D.bg, borderRight: `1px solid ${D.line}` }}>
      {/* Panel header */}
      <div style={{
        height: 38, background: D.canvas, borderBottom: `1px solid ${D.line}`,
        display: "flex", alignItems: "center", padding: "0 20px", flexShrink: 0, gap: 8,
      }}>
        <Layers size={13} strokeWidth={1.8} color={D.muted} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: D.ink, letterSpacing: "-0.01em" }}>
          Cross-Channel Enrichment Status
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <Badge color={D.blue} bg={D.blueSoft}><Zap size={8} strokeWidth={2} color={D.blue} />AI-Enriched</Badge>
          <span style={{ fontSize: 9, color: D.muted, fontFamily: D.mono, padding: "1px 5px", border: `1px solid ${D.line}`, borderRadius: 3, background: D.surface }}>2 sources</span>
        </div>
      </div>

      {/* Scrollable — clip + auto */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "clip",
        padding: "18px 16px", display: "flex", flexDirection: "column",
        gap: 14, minHeight: 0,
      }}>
        {/* Identity stripe */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 8, background: D.canvas, border: `1px solid ${D.line}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg, ${D.blue} 0%, #4F46E5 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>AM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: D.ink, letterSpacing: "-0.025em", lineHeight: 1.2 }}>Alex M. Richardson</div>
            <div style={{ fontSize: 10.5, color: D.muted, lineHeight: 1.4, marginTop: 1 }}>Senior Backend Engineer · San Francisco, CA</div>
          </div>
          <Badge color={D.blue} bg={D.blueSoft}>Screening</Badge>
        </div>

        <SectionLabel>External Platform Integrations</SectionLabel>

        <GitHubCard expanded={openCard === "github"} onToggle={() => toggle("github")} />
        <LinkedInCard expanded={openCard === "linkedin"} onToggle={() => toggle("linkedin")} />

        <Divider />

        {/* Sync status */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 6, background: D.surface, border: `1px solid ${D.line}`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: D.mint, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: D.sub, flex: 1 }}>
            <strong style={{ fontWeight: 600, color: D.ink }}>Automated Synchronization:</strong>{" "}
            <span style={{ fontFamily: D.mono, fontSize: 10.5, fontWeight: 600, color: D.mint }}>IDLE / UP-TO-DATE</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <Clock size={10} strokeWidth={2} color={D.dim} />
            <span style={{ fontSize: 10, color: D.muted, fontFamily: D.mono }}>Last sync: Just now</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 10px",
          borderRadius: 5, background: `${D.amber}0B`, border: `1px solid ${D.amber}22`,
        }}>
          <AlertCircle size={11} strokeWidth={2} color={D.amber} style={{ marginTop: 0.5, flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, color: D.sub, lineHeight: 1.5 }}>
            Data enrichment is based on publicly available sources. Manual verification recommended for final hiring decisions.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Enriched Radar Chart ─────────────────────────────────────────────────────
function EnrichedRadar() {
  const [showBoth, setShowBoth] = useState(true);
  const data = radarBase.map((d) => ({
    skill: d.skill,
    "Pre-Enrichment": d.base,
    "Post-Enrichment": d.enriched,
    fullMark: 100,
  }));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: D.ink, letterSpacing: "-0.02em", marginBottom: 2 }}>Technical Skill Matrix</div>
          <div style={{ fontSize: 10.5, color: D.muted }}>Multi-axis competency · enriched with external repository data</div>
        </div>
        <button
          onClick={() => setShowBoth(!showBoth)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
            border: `1px solid ${showBoth ? `${D.blue}30` : D.line}`,
            borderRadius: 5, background: showBoth ? D.blueSoft : D.canvas,
            cursor: "pointer", fontSize: 10.5,
            color: showBoth ? D.blue : D.sub, fontFamily: D.font,
            fontWeight: showBoth ? 600 : 400, transition: "all 0.15s ease",
          }}
        >
          <TrendingUp size={10} strokeWidth={2} color={showBoth ? D.blue : D.muted} />
          Show delta
        </button>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 36, bottom: 8, left: 36 }}>
            <PolarGrid stroke={D.line} strokeWidth={0.75} />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: D.sub, fontFamily: D.font, fontWeight: 500 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar key="pre" name="Pre-Enrichment" dataKey="Pre-Enrichment"
              stroke={showBoth ? D.line : "transparent"}
              strokeWidth={1.5} fill={showBoth ? D.muted : "transparent"}
              fillOpacity={showBoth ? 0.07 : 0} strokeDasharray="4 2"
            />
            <Radar key="post" name="Post-Enrichment" dataKey="Post-Enrichment"
              stroke={D.blue} strokeWidth={1.75} fill={D.blue} fillOpacity={0.15}
            />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { skill: string; "Pre-Enrichment": number; "Post-Enrichment": number };
              return (
                <div style={{ background: D.ink, color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 11, fontFamily: D.font, minWidth: 130 }}>
                  <div style={{ fontWeight: 600, marginBottom: 5 }}>{d.skill}</div>
                  {showBoth && <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3, color: D.dim }}><span>Baseline</span><span style={{ fontFamily: D.mono }}>{d["Pre-Enrichment"]}</span></div>}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#93C5FD" }}><span>Enriched</span><span style={{ fontFamily: D.mono, fontWeight: 600 }}>{d["Post-Enrichment"]}</span></div>
                  {showBoth && <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", gap: 12, color: "#6EE7B7", fontWeight: 600 }}><span>Delta</span><span style={{ fontFamily: D.mono }}>+{d["Post-Enrichment"] - d["Pre-Enrichment"]}</span></div>}
                </div>
              );
            }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {showBoth && (
        <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 16, height: 1.5, borderTop: "1.5px dashed #9CA3AF" }} />
            <span style={{ color: D.muted }}>Pre-enrichment</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 16, height: 2, background: D.blue, borderRadius: 1 }} />
            <span style={{ color: D.sub }}>Post-enrichment</span>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0 10px" }}>
        {radarBase.map((s) => (
          <div key={s.skill}>
            <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: D.mono, color: D.ink, marginBottom: 3 }}>
              {s.enriched}
              {s.enriched > s.base && <span style={{ fontSize: 8.5, fontWeight: 600, color: D.mint, marginLeft: 3 }}>+{s.enriched - s.base}</span>}
            </div>
            <div style={{ height: 2.5, background: D.line, borderRadius: 99, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${s.enriched}%`, background: D.blue, borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: 9, color: D.muted, marginTop: 3 }}>{s.skill}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Match Confidence (enriched) ──────────────────────────────────────────────
function MatchConfidence() {
  const score = 89.5; const r = 44;
  const circ = 2 * Math.PI * r; const fill = (score / 100) * circ;
  return (
    <div style={{
      padding: "16px 18px", borderRadius: 8,
      background: `linear-gradient(145deg, ${D.blue}0A 0%, ${D.canvas} 60%)`,
      border: `1px solid ${D.blue}28`,
      display: "flex", alignItems: "center", gap: 20,
    }}>
      <div style={{ flexShrink: 0 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke={D.line} strokeWidth="6" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={D.blue} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            strokeDashoffset={circ / 4}
          />
          <text x="50" y="44" textAnchor="middle" fontSize="16" fontWeight="800" fill={D.ink} fontFamily="'Inter', sans-serif" letterSpacing="-0.05em">89.5</text>
          <text x="50" y="57" textAnchor="middle" fontSize="9" fill={D.muted} fontFamily="'Inter', sans-serif">/ 100</text>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.muted, marginBottom: 4 }}>Match Confidence</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: D.ink, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 5 }}>
          89.5 <span style={{ fontSize: 14, color: D.muted, fontWeight: 400 }}>/ 100</span>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 8px", borderRadius: 5,
          background: D.mintSoft, border: `1px solid ${D.mint}28`, marginBottom: 10,
        }}>
          <TrendingUp size={10} strokeWidth={2} color={D.mint} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: D.mint }}>+2.1 increase from external data enrichment</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[{ label: "Experience Fit", pct: 93 }, { label: "Skills Alignment", pct: 87 }, { label: "Culture Signal", pct: 81 }].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: D.muted, width: 96, flexShrink: 0 }}>{item.label}</span>
              <div style={{ flex: 1, height: 3, background: D.line, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${item.pct}%`, height: "100%", background: `linear-gradient(90deg, ${D.blue}, #4F46E5)`, borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 9.5, fontFamily: D.mono, fontWeight: 600, color: D.sub, width: 28, textAlign: "right", flexShrink: 0 }}>{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Career Timeline (verified) ───────────────────────────────────────────────
function CareerTimeline() {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: D.ink, letterSpacing: "-0.02em" }}>Career Trajectory</div>
          <div style={{ fontSize: 10.5, color: D.muted, marginTop: 1 }}>Verified chronological milestones · LinkedIn cross-referenced</div>
        </div>
        <ChevronDown size={14} strokeWidth={2} color={D.muted}
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease" }} />
      </div>
      {expanded && (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 44, top: 6, bottom: 6, width: 1, background: D.line }} />
          {timelineItems.map((item, i) => (
            <div key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ display: "flex", alignItems: "flex-start", marginBottom: i < timelineItems.length - 1 ? 8 : 0, cursor: "default" }}
            >
              <div style={{ width: 36, flexShrink: 0, textAlign: "right", paddingTop: 4, fontSize: 9.5, fontWeight: item.current ? 700 : 500, color: item.current ? D.blue : D.dim, fontFamily: D.mono }}>{item.year}</div>
              <div style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 6, position: "relative", zIndex: 1, marginLeft: -1 }}>
                <div style={{
                  width: item.current ? 9 : 7, height: item.current ? 9 : 7, borderRadius: "50%",
                  background: item.current ? D.blue : item.type === "edu" ? D.purple : item.verified ? D.mint : D.dim,
                  border: `2px solid ${item.current ? D.blue : item.type === "edu" ? D.purple : item.verified ? D.mint : D.line}`,
                  transition: "transform 0.12s", transform: hovered === i ? "scale(1.5)" : "scale(1)",
                  boxShadow: item.current ? `0 0 0 3px ${D.blue}18` : undefined,
                }} />
              </div>
              <div style={{
                flex: 1, padding: "4px 10px 8px", marginLeft: 4, borderRadius: 6,
                background: hovered === i ? D.surface : "transparent",
                border: `1px solid ${hovered === i ? D.line : "transparent"}`,
                transition: "all 0.15s ease", minWidth: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 1 }}>
                  {item.type === "work" ? <Briefcase size={9.5} strokeWidth={2} color={item.current ? D.blue : D.muted} /> : <GraduationCap size={9.5} strokeWidth={2} color={D.purple} />}
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: D.ink }}>{item.title}</span>
                  {item.current && <Badge color={D.blue} bg={D.blueSoft}>NOW</Badge>}
                  {item.type === "edu" && <Badge color={D.purple} bg={`${D.purple}10`}>EDU</Badge>}
                  {item.verified && <Badge color={D.mint} bg={D.mintSoft}><CheckCircle2 size={8} strokeWidth={2} color={D.mint} />Verified</Badge>}
                </div>
                <div style={{ fontSize: 10.5, color: D.sub, marginBottom: 1 }}>{item.org}</div>
                <div style={{ fontSize: 9.5, color: D.dim, fontFamily: D.mono, marginBottom: 3 }}>{item.period}</div>
                <div style={{ fontSize: 10.5, color: D.muted, lineHeight: 1.45 }}>{item.note}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Right Panel — Enriched Analytics ────────────────────────────────────────
function EnrichedAnalytics() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: D.canvas }}>
      <div style={{
        height: 38, background: D.canvas, borderBottom: `1px solid ${D.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={13} strokeWidth={1.8} color={D.muted} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: D.ink, letterSpacing: "-0.01em" }}>Unified Candidate Analytics</span>
          <span style={{ fontSize: 9.5, fontFamily: D.mono, color: D.muted, padding: "1px 5px", border: `1px solid ${D.line}`, borderRadius: 3, background: D.surface }}>post-enrichment</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Dot color={D.mint} pulse />
          <span style={{ fontSize: 10, color: D.muted, fontFamily: D.mono }}>LIVE · wss://ats.internal:8421</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "clip", padding: "20px 22px", minHeight: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Match Confidence Score</SectionLabel>
          <MatchConfidence />
        </div>
        <Divider />
        <div style={{ marginBottom: 20 }}><EnrichedRadar /></div>
        <Divider />
        <div style={{ marginBottom: 20 }}><CareerTimeline /></div>
        <Divider />

        {/* Enrichment Impact Summary */}
        <div style={{ marginBottom: 12 }}>
          <SectionLabel>Enrichment Impact Summary</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { icon: <GitBranch size={13} strokeWidth={1.8} color={D.blue} />, label: "Repos Corroborating", value: "14", sub: "public repositories", color: D.blue },
              { icon: <CheckCircle2 size={13} strokeWidth={1.8} color={D.mint} />, label: "Roles Verified", value: "3 / 3", sub: "95% CV alignment", color: D.mint },
              { icon: <Cpu size={13} strokeWidth={1.8} color={D.purple} />, label: "Skills Confirmed", value: "11", sub: "from README analysis", color: D.purple },
            ].map((item, i) => (
              <div key={i} style={{ padding: "11px 13px", borderRadius: 7, background: `${item.color}08`, border: `1px solid ${item.color}20`, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {item.icon}
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: item.color, letterSpacing: "0.04em" }}>{item.label.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: D.ink, letterSpacing: "-0.04em", lineHeight: 1, fontFamily: D.mono }}>{item.value}</div>
                <div style={{ fontSize: 10, color: D.muted }}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            borderRadius: 5, background: D.surface, border: `1px solid ${D.line}`,
          }}>
            <Globe size={10} strokeWidth={2} color={D.muted} />
            <span style={{ fontSize: 10, color: D.muted, flex: 1 }}>
              Sources: <span style={{ color: D.sub, fontWeight: 500 }}>GitHub (14 repos, 23 commits analyzed)</span>{" · "}
              <span style={{ color: D.sub, fontWeight: 500 }}>LinkedIn (3 verified positions)</span>
            </span>
            <span style={{ fontSize: 9, fontFamily: D.mono, color: D.dim }}>June 25, 2026 · 10:42 AM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Frame 2 ──────────────────────────────────────────────────────────────────
export default function AIAgentPromptPage() {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", animation: "fadeSlideIn 0.4s ease both" }}>
      {/* Left — enrichment dashboard */}
      <div style={{ flex: "0 0 44%", minWidth: 0, overflow: "hidden" }}>
        <EnrichmentPanel />
      </div>
      {/* Divider */}
      <div style={{ width: 1, background: D.line, flexShrink: 0 }} />
      {/* Right — enriched analytics */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <EnrichedAnalytics />
      </div>
    </div>
  );
}
