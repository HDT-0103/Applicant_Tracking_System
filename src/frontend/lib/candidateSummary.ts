/**
 * Shapes raw Supabase rows into what the candidate list can render.
 *
 * Lives here rather than in page.tsx because it is pure data logic with no
 * JSX, which makes it testable without mounting React.
 */

/**
 * Reads the first record of an embedded relation, accepting either shape.
 *
 * PostgREST returns an ARRAY for one-to-many relations but an OBJECT for
 * one-to-one, inferring which from whether the foreign key is unique:
 *
 *     applications         -> array  (a candidate may submit many applications)
 *     enrichment_profiles  -> object (candidate_uuid is unique)
 *     github_profiles      -> object (candidate_uuid is unique)
 *
 * The dashboard used to write `c.enrichment_profiles?.[0]` for all three. On an
 * object that is always `undefined`, so enrichment status and match score NEVER
 * rendered correctly. The bug throws nothing and quietly yields empty values,
 * which reads as "no data yet".
 */
export function firstOf<T>(relation: T | T[] | null | undefined): T | undefined {
  if (!relation) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}

export interface MustHaveSummary {
  matched: number;
  total: number;
}

/**
 * Reads how many required skills matched, from the `skill_matrix` the pipeline
 * writes.
 *
 * Returns `null` when the job posting declares no required skills. Rendering
 * "0/0" would only confuse, and worse, would read as a candidate matching
 * nothing at all.
 */
export function readMustHave(skillMatrix: unknown): MustHaveSummary | null {
  if (!skillMatrix || typeof skillMatrix !== "object") return null;
  const must = (skillMatrix as Record<string, unknown>).must_have as
    | Record<string, unknown>
    | undefined;
  if (!must) return null;

  const matched = Array.isArray(must.matched) ? must.matched.length : 0;
  const missing = Array.isArray(must.missing) ? must.missing.length : 0;
  const total = matched + missing;

  return total > 0 ? { matched, total } : null;
}

/**
 * `top_languages` is JSON shaped like `{"Go": 70.0, "Python": 30.0}`. Takes the
 * few highest-weighted languages to render as chips.
 */
export function topLanguages(raw: unknown, limit = 3): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([name, weight]) => name && Number.isFinite(Number(weight)))
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * Joins "Company · Location", dropping whichever half is missing.
 *
 * Concatenating with a separator unconditionally leaves an orphaned " · Hanoi"
 * when the company is unknown, which reads as a rendering bug.
 */
export function candidateContext(
  company: string | null | undefined,
  location: string | null | undefined,
): string | null {
  const parts = [company, location].filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
