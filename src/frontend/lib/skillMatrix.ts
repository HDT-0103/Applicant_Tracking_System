/**
 * Parses the `skill_matrix` JSON the enrichment pipeline writes.
 *
 * Kept separate from the component so the parsing rules can be tested without
 * rendering anything, and because the shape comes from the backend — a
 * mismatch here shows up as an empty panel rather than an error, so it needs
 * covering in its own right.
 *
 * Written by `CVProcessingPipeline._build_skill_matrix`:
 *
 *     {
 *       "must_have":     { "matched": [...], "missing": [...] },
 *       "nice_to_have":  { "matched": [...], "missing": [...] },
 *       "must_have_coverage": 0.66 | null,
 *       "extra_skills":  [...]
 *     }
 */

export interface SkillGroup {
  matched: string[];
  missing: string[];
}

export interface SkillMatch {
  mustHave: SkillGroup & { total: number };
  niceToHave: SkillGroup;
  extra: string[];
  /** Fraction of required skills met, or `null` when the posting names none. */
  coverage: number | null;
}

/** Keeps only non-empty strings; the LLM occasionally emits blanks. */
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function group(value: unknown): SkillGroup {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    matched: cleanList(record.matched),
    missing: cleanList(record.missing),
  };
}

/**
 * Returns `null` when there is nothing worth showing.
 *
 * A candidate whose enrichment has not run yet, or a posting that lists no
 * skills at all, should render an explanatory line rather than an empty shell
 * of headings with no chips under them.
 */
export function parseSkillMatrix(raw: unknown): SkillMatch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const mustHave = group(record.must_have);
  const niceToHave = group(record.nice_to_have);
  const extra = cleanList(record.extra_skills);

  const total = mustHave.matched.length + mustHave.missing.length;
  const nothingToShow =
    total === 0 &&
    niceToHave.matched.length === 0 &&
    niceToHave.missing.length === 0 &&
    extra.length === 0;
  if (nothingToShow) return null;

  const rawCoverage = record.must_have_coverage;
  // Recompute rather than trusting the stored value: it can be stale if the
  // posting's requirements changed after the profile was last enriched.
  const coverage = total > 0 ? mustHave.matched.length / total : null;

  return {
    mustHave: { ...mustHave, total },
    niceToHave,
    extra,
    coverage:
      typeof rawCoverage === "number" && total === 0 ? rawCoverage : coverage,
  };
}
