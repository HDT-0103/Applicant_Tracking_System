"use client";

import React from "react";
import { Check, X, Plus } from "lucide-react";
import { D } from "../lib/shared";
import { parseSkillMatrix, type SkillMatch } from "../lib/skillMatrix";

/**
 * Explains a match score instead of just stating it.
 *
 * A bare "70% match" gives a recruiter nothing to agree or disagree with. They
 * cannot tell whether the candidate missed something critical or simply lacks a
 * nice-to-have, so the number gets ignored — or worse, trusted blindly. Showing
 * which requirements were met, which were missed, and what the candidate brings
 * beyond the posting turns the score into something reviewable.
 *
 * The data already exists: the enrichment pipeline writes `skill_matrix` to
 * `enrichment_profiles`. Nothing here needs a new endpoint.
 */

export interface SkillMatchPanelProps {
  /** Raw `skill_matrix` JSON as stored on the enrichment profile. */
  skillMatrix: unknown;
  /** Overall match score, 0–100, shown as the headline when present. */
  score?: number | null;
}

export const SkillMatchPanel: React.FC<SkillMatchPanelProps> = ({
  skillMatrix,
  score,
}) => {
  const match = parseSkillMatrix(skillMatrix);

  if (!match) {
    return (
      <div style={{ fontSize: 12.5, color: D.muted }}>
        No skill breakdown yet — run enrichment for this candidate to generate one.
      </div>
    );
  }

  return (
    <section
      aria-label="Skill match breakdown"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {typeof score === "number" && (
        <Headline score={score} match={match} />
      )}

      <ChipRow
        title="Required — matched"
        tone={D.mint}
        icon={<Check size={11} strokeWidth={2.5} aria-hidden="true" />}
        skills={match.mustHave.matched}
      />
      <ChipRow
        title="Required — missing"
        tone={D.red}
        icon={<X size={11} strokeWidth={2.5} aria-hidden="true" />}
        skills={match.mustHave.missing}
        // Silence is ambiguous here: an empty "missing" row reads very
        // differently from no row at all, and it is the reassuring case.
        emptyLabel="None — every required skill is covered"
      />
      <ChipRow
        title="Nice to have — matched"
        tone={D.blue}
        icon={<Check size={11} strokeWidth={2.5} aria-hidden="true" />}
        skills={match.niceToHave.matched}
      />
      <ChipRow
        title="Beyond the posting"
        tone={D.purple}
        icon={<Plus size={11} strokeWidth={2.5} aria-hidden="true" />}
        skills={match.extra}
      />
    </section>
  );
};

function Headline({ score, match }: { score: number; match: SkillMatch }) {
  const matched = match.mustHave.matched.length;
  const total = match.mustHave.total;
  const complete = total > 0 && matched === total;

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: D.ink,
          fontFamily: D.mono,
          lineHeight: 1,
        }}
      >
        {Math.round(score)}%
      </span>
      <span style={{ fontSize: 12.5, color: D.muted }}>
        overall match
      </span>
      {total > 0 && (
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: complete ? D.mint : D.amber,
            padding: "2px 8px",
            borderRadius: 999,
            background: complete ? `${D.mint}12` : `${D.amber}12`,
          }}
        >
          {matched}/{total} required skills
        </span>
      )}
    </div>
  );
}

function ChipRow({
  title,
  tone,
  icon,
  skills,
  emptyLabel,
}: {
  title: string;
  tone: string;
  icon: React.ReactNode;
  skills: string[];
  emptyLabel?: string;
}) {
  // Rows with nothing to say are dropped rather than rendered empty — except
  // where the emptiness is itself the message.
  if (skills.length === 0 && !emptyLabel) return null;

  return (
    <div>
      <h4
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: D.muted,
          margin: "0 0 7px",
        }}
      >
        {title}
      </h4>

      {skills.length === 0 ? (
        <p style={{ fontSize: 12, color: D.dim, margin: 0 }}>{emptyLabel}</p>
      ) : (
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {skills.map((skill) => (
            <li
              key={skill}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 500,
                color: tone,
                background: `${tone}10`,
                border: `1px solid ${tone}28`,
              }}
            >
              {icon}
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
