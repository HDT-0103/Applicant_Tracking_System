"use client";

import React from "react";
import { CandidateAnalytics } from "../../context/WorkspaceContext";

/* ------------------------------------------------------------------ */
/*  Sub-component: Candidate Header                                     */
/* ------------------------------------------------------------------ */
const CandidateHeader: React.FC<{ data: CandidateAnalytics }> = ({ data }) => (
  <div className="candidate-header">
    <div className="name-block">
      <h1 className="candidate-name">{data.fullName}</h1>
      <p className="candidate-title">
        {data.title} · {data.location}
      </p>
    </div>
    <div className="badge-col">
      <span className="assessment-badge">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
        </svg>
        {data.assessmentStatus}
      </span>
      <span className="department-tag">{data.department}</span>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Sub-component: Meta Tags row                                        */
/* ------------------------------------------------------------------ */
const MetaTags: React.FC<{ data: CandidateAnalytics }> = ({ data }) => (
  <div className="meta-tags">
    <span className="meta-tag">
      <span className="meta-label">Applied</span> {data.appliedRole}
    </span>
    <span className="meta-tag">
      <span className="meta-label">Date</span> {data.appliedDate}
    </span>
    <span className="meta-tag">
      <span className="meta-label">Source</span> {data.source}
    </span>
    <span className="meta-tag">
      <span className="meta-label">Seniority</span> {data.seniority}
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Sub-component: Affinity Score Panel                                 */
/* ------------------------------------------------------------------ */
const AffinityScorePanel: React.FC<{ data: CandidateAnalytics }> = ({
  data,
}) => (
  <div className="affinity-section">
    <span className="section-label">Overall Affinity</span>

    <div className="affinity-score-row">
      <span className="affinity-score-number">{data.affinityScore}</span>
      <span className="affinity-score-denom">/100</span>
      <span style={{ flex: 1 }} />
      <span className="confidence-pill">● {data.matchConfidence}</span>
      <span className="percentile-text">· {data.matchPercentile}st percentile</span>
    </div>

    <div className="breakdown-bars">
      <div className="bar-row">
        <span className="bar-label">Experience</span>
        <div className="bar-track">
          <div
            className="bar-fill experience"
            style={{ width: `${data.breakdown.experience}%` }}
          />
        </div>
        <span className="bar-value">{data.breakdown.experience}%</span>
      </div>
      <div className="bar-row">
        <span className="bar-label">Skills Fit</span>
        <div className="bar-track">
          <div
            className="bar-fill skills"
            style={{ width: `${data.breakdown.skillsFit}%` }}
          />
        </div>
        <span className="bar-value">{data.breakdown.skillsFit}%</span>
      </div>
      <div className="bar-row">
        <span className="bar-label">Culture</span>
        <div className="bar-track">
          <div
            className="bar-fill culture"
            style={{ width: `${data.breakdown.culture}%` }}
          />
        </div>
        <span className="bar-value">{data.breakdown.culture}%</span>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Sub-component: SVG Radar Chart (Pentagon)                          */
/* ------------------------------------------------------------------ */
const SkillRadarChart: React.FC<{ skills: CandidateAnalytics["skills"] }> = ({
  skills,
}) => {
  const cx = 120;
  const cy = 120;
  const R = 90; // outer radius
  const levels = 5;
  const n = skills.length;

  /** Convert polar to cartesian */
  const polar = (angle: number, r: number) => ({
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  });

  /** Build SVG polygon points string from array of {x,y} */
  const toPoints = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const angles = skills.map((_, i) => (2 * Math.PI * i) / n);

  // Grid polygon levels
  const gridLevels = Array.from({ length: levels }, (_, l) => {
    const r = (R * (l + 1)) / levels;
    return toPoints(angles.map((a) => polar(a, r)));
  });

  // Data polygon
  const dataPoints = skills.map((s, i) =>
    polar(angles[i], (s.score / 100) * R),
  );

  // Axis lines and labels
  const axisEnds = angles.map((a) => polar(a, R));
  const labelPts = angles.map((a, i) => polar(a, R + 18));

  return (
    <div className="radar-wrapper">
      <svg width={240} height={240} viewBox="0 0 240 240" aria-label="Skill radar chart">
        {/* Grid lines */}
        {gridLevels.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Axis spokes */}
        {axisEnds.map((pt, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={pt.x}
            y2={pt.y}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Data area */}
        <polygon
          points={toPoints(dataPoints)}
          fill="rgba(79,70,229,0.15)"
          stroke="#4f46e5"
          strokeWidth="2"
        />

        {/* Data dots */}
        {dataPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill="#4f46e5"
          />
        ))}

        {/* Labels */}
        {labelPts.map((pt, i) => (
          <text
            key={i}
            x={pt.x}
            y={pt.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fill="#6b7280"
          >
            {skills[i].name}
          </text>
        ))}
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-component: Skill Score Breakdown Row                           */
/* ------------------------------------------------------------------ */
const SkillBreakdownRow: React.FC<{
  skills: CandidateAnalytics["skills"];
}> = ({ skills }) => (
  <div className="skill-breakdown-row">
    {skills.map((s) => (
      <div className="skill-score-card" key={s.name}>
        <span className="skill-score-value">{s.score}</span>
        <span className="skill-score-label">{s.name}</span>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Sub-component: Career Timeline                                      */
/* ------------------------------------------------------------------ */
const CareerTimeline: React.FC<{
  trajectory: CandidateAnalytics["trajectory"];
}> = ({ trajectory }) => (
  <div className="timeline">
    {trajectory.map((item, idx) => (
      <div className="timeline-item" key={idx}>
        <div
          className={`timeline-dot${item.isCurrent ? " current" : item.type === "edu" ? " edu" : ""}`}
        />
        <div className="timeline-role">
          {item.role}
          {item.isCurrent && <span className="current-badge">Current</span>}
          {item.type === "edu" && !item.isCurrent && (
            <span className="edu-badge">EDU</span>
          )}
        </div>
        <div className="timeline-company">{item.company}</div>
        <div className="timeline-period">{item.period}</div>
        <div className="timeline-highlight">{item.highlight}</div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Sub-component: Decision Bar                                         */
/* ------------------------------------------------------------------ */
const CandidateDecisionBar: React.FC<{ onReset: () => void }> = ({
  onReset,
}) => (
  <div className="decision-bar">
    <span className="decision-label">Candidate Decision</span>
    <button className="btn-approve" type="button">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
      </svg>
      Approve to Interview
    </button>
    <button className="btn-reject" type="button" onClick={onReset}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
      </svg>
      Reject Profile
    </button>
    <button className="btn-action" type="button">Flag</button>
    <button className="btn-action" type="button">Share</button>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main: AiAnalyticsWorkspace                                          */
/* ------------------------------------------------------------------ */
interface Props {
  data: CandidateAnalytics;
  onReset: () => void;
}

export const AiAnalyticsWorkspace: React.FC<Props> = ({ data, onReset }) => (
  <div className="analytics-workspace">
    {/* Sticky header bar */}
    <div className="analytics-header-bar">
      <span className="workspace-title">Verification Workspace</span>
      <span className="candidate-id">candidate-{data.uuid.slice(0, 8)}</span>
      <span className="live-sync">● LIVE SYNC wss://ats.internal:8421</span>
    </div>

    <div className="analytics-content">
      <CandidateHeader data={data} />
      <MetaTags data={data} />
      <AffinityScorePanel data={data} />

      <div className="skill-section">
        <span className="section-label">Technical Skill Matrix</span>
        <p className="section-sub">AI-computed multi-axis competency</p>
        <SkillRadarChart skills={data.skills} />
        <SkillBreakdownRow skills={data.skills} />
      </div>

      <div className="career-section">
        <span className="section-label">Career Trajectory</span>
        <p className="section-sub">Chronological professional milestones</p>
        <CareerTimeline trajectory={data.trajectory} />
      </div>
    </div>

    <CandidateDecisionBar onReset={onReset} />
  </div>
);
