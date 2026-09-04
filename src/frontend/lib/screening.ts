// --- Applicant screening questionnaire ---------------------------------------
// Only asks what a CV cannot tell us. Name, email, phone, social links, school
// and years of experience are extracted from the uploaded CV instead, so the
// form stays down to five questions on a single page.
//
// Kept free of React so it can be unit-tested without rendering the form.

import { MESSAGES } from "./i18n/messages";

export type Choice = { value: string; label: string; hint?: string };

/**
 * Shape of the translator the form hands in (`useT()` from lib/i18n). Kept as
 * a plain function type so this module never touches React or the context.
 */
export type ScreeningT = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Default translator: English, read from the same dictionary the page uses.
 *
 * Pulling the text from MESSAGES instead of repeating it here is deliberate:
 * screening.test.ts asserts on the exact English wording, and a second copy
 * of the same sentence would let the two drift apart without any test noticing.
 */
const englishT: ScreeningT = (key, vars) => {
  const entry = (MESSAGES as Record<string, { en: string }>)[key];
  let text = entry ? entry.en : key;
  for (const [k, v] of Object.entries(vars ?? {})) text = text.split(`{${k}}`).join(String(v));
  return text;
};

export const WORK_MODE_OPTIONS: Choice[] = [
  { value: "onsite", label: "Full-time onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Fully remote" },
];

export const AVAILABILITY_OPTIONS: Choice[] = [
  { value: "immediate", label: "Immediately" },
  { value: "two_weeks", label: "In 2 weeks" },
  { value: "one_month", label: "In 1 month" },
  { value: "other", label: "Another date" },
];

export const MOTIVATION_OPTIONS: Choice[] = [
  { value: "growth", label: "New challenges" },
  { value: "promotion", label: "Better growth path" },
  { value: "pivot", label: "Changing direction" },
  { value: "other", label: "Something else" },
];

export const WORK_STYLE_OPTIONS: Choice[] = [
  { value: "independent", label: "Independent", hint: "Give me the goal, I will find the way" },
  { value: "collaborative", label: "Collaborative", hint: "I like constant discussion and feedback" },
  { value: "structured", label: "Structured", hint: "I work best with clear processes and checklists" },
];

export const SALARY_BASIS_OPTIONS: Choice[] = [
  { value: "gross", label: "Gross" },
  { value: "net", label: "Net" },
];

export const RATING_HINTS = ["Just starting", "Basic", "Comfortable", "Proficient", "Expert"];
export const MAX_RATED_SKILLS = 12;

export type ScreeningGroup = "salaryBasis" | "workMode" | "availability" | "motivation" | "workStyle";

/**
 * Option value -> i18n key, one map per question. The `label` on each Choice
 * stays English (tests and any non-React caller read it); the form looks the
 * key up here and renders `t(key)` so the candidate sees their own language.
 *
 * Values are the strings written to `applications`, so they never change —
 * only the wording shown next to them does.
 */
export const SCREENING_LABEL_KEYS: Record<ScreeningGroup, Record<string, string>> = {
  salaryBasis: {
    gross: "careers.screening.salaryBasis.gross",
    net: "careers.screening.salaryBasis.net",
  },
  workMode: {
    onsite: "careers.screening.workMode.onsite",
    hybrid: "careers.screening.workMode.hybrid",
    remote: "careers.screening.workMode.remote",
  },
  availability: {
    immediate: "careers.screening.availability.immediate",
    two_weeks: "careers.screening.availability.two_weeks",
    one_month: "careers.screening.availability.one_month",
    other: "careers.screening.availability.other",
  },
  motivation: {
    growth: "careers.screening.motivation.growth",
    promotion: "careers.screening.motivation.promotion",
    pivot: "careers.screening.motivation.pivot",
    other: "careers.screening.motivation.other",
  },
  workStyle: {
    independent: "careers.screening.workStyle.independent",
    collaborative: "careers.screening.workStyle.collaborative",
    structured: "careers.screening.workStyle.structured",
  },
};

/** Only the working-style question carries a hint line under each label. */
export const SCREENING_HINT_KEYS: Record<string, string> = {
  independent: "careers.screening.workStyle.independent.hint",
  collaborative: "careers.screening.workStyle.collaborative.hint",
  structured: "careers.screening.workStyle.structured.hint",
};

/** Parallel to RATING_HINTS: index 0 is the hint for rating 1. */
export const RATING_HINT_KEYS = [
  "careers.screening.rating.1",
  "careers.screening.rating.2",
  "careers.screening.rating.3",
  "careers.screening.rating.4",
  "careers.screening.rating.5",
];

/** Digits only, grouped for display: "15000000" -> "15,000,000". */
export const formatVnd = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
};

/** "15,000,000" -> 15000000; empty -> null so the column stays NULL. */
export const toAmount = (raw: string): number | null => {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};

/** Skills to rate, taken from the job itself so the matrix matches the role. */
export function pickRatedSkills(
  job: { must_have_skills?: string[] | null; nice_to_have_skills?: string[] | null },
): string[] {
  return [...(job.must_have_skills ?? []), ...(job.nice_to_have_skills ?? [])]
    .filter((s, i, arr) => !!s && arr.indexOf(s) === i)
    .slice(0, MAX_RATED_SKILLS);
}

export interface ScreeningAnswers {
  salaryMin: string;
  salaryMax: string;
  salaryBasis: string;
  workModePref: string[];
  availabilityBucket: string;
  availabilityDate: string;
  skillRatings: Record<string, number>;
  workStyle: string;
  motivationReason: string;
  motivationOther: string;
  consent: boolean;
}

export type ScreeningErrors = Partial<Record<keyof ScreeningAnswers, string>>;

/**
 * The five questions are all click-to-answer, so they are required. Motivation
 * is the one optional question — it feeds NLP analysis but must not gate submit.
 *
 * `requiredSkills` comes from the job; an empty list means the job declared no
 * skills and the matrix is not shown at all.
 *
 * `t` is optional so existing callers (and the tests) keep getting English;
 * the form passes `useT()` to get the candidate's language.
 */
export function validateScreening(
  a: ScreeningAnswers,
  requiredSkills: string[] = [],
  t: ScreeningT = englishT,
): ScreeningErrors {
  const e: ScreeningErrors = {};

  const min = toAmount(a.salaryMin);
  const max = toAmount(a.salaryMax);
  if (min === null || max === null) e.salaryMax = t("careers.screening.error.salaryRange");
  else if (max < min) e.salaryMax = t("careers.screening.error.salaryOrder");

  if (!a.workModePref.length) e.workModePref = t("careers.screening.error.workMode");

  if (!a.availabilityBucket) e.availabilityBucket = t("careers.screening.error.availability");
  if (a.availabilityBucket === "other" && !a.availabilityDate)
    e.availabilityDate = t("careers.screening.error.availabilityDate");

  const unrated = requiredSkills.filter((s) => !a.skillRatings[s]);
  if (unrated.length)
    e.skillRatings = t("careers.screening.error.skills", {
      total: requiredSkills.length,
      left: unrated.length,
    });

  if (!a.workStyle) e.workStyle = t("careers.screening.error.workStyle");

  if (!a.consent) e.consent = t("careers.screening.error.consent");

  return e;
}

/**
 * Inverse of buildScreeningPayload: maps an `applications` row back onto form
 * answers, so a returning candidate sees their previous submission pre-filled.
 */
export function screeningAnswersFromRow(row: Record<string, unknown>): ScreeningAnswers {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    salaryMin: row.expected_salary_min != null ? formatVnd(String(row.expected_salary_min)) : "",
    salaryMax: row.expected_salary_max != null ? formatVnd(String(row.expected_salary_max)) : "",
    salaryBasis: str(row.salary_basis) || "gross",
    workModePref: Array.isArray(row.work_mode_pref) ? (row.work_mode_pref as string[]) : [],
    availabilityBucket: str(row.availability_bucket),
    availabilityDate: str(row.availability_date),
    skillRatings:
      row.skill_ratings && typeof row.skill_ratings === "object" && !Array.isArray(row.skill_ratings)
        ? (row.skill_ratings as Record<string, number>)
        : {},
    workStyle: str(row.work_style),
    motivationReason: str(row.motivation_reason),
    motivationOther: str(row.motivation_other),
    consent: !!row.consent_data_sharing,
  };
}

/** Maps answers onto the `applications` columns added by V004. */
export function buildScreeningPayload(a: ScreeningAnswers, consentAt: string) {
  return {
    expected_salary_min: toAmount(a.salaryMin),
    expected_salary_max: toAmount(a.salaryMax),
    salary_basis: a.salaryBasis || null,
    work_mode_pref: a.workModePref,
    availability_bucket: a.availabilityBucket || null,
    availability_date:
      a.availabilityBucket === "other" && a.availabilityDate ? a.availabilityDate : null,
    skill_ratings: Object.fromEntries(Object.entries(a.skillRatings).filter(([, v]) => v > 0)),
    motivation_reason: a.motivationReason || null,
    motivation_other: a.motivationOther.trim() || null,
    work_style: a.workStyle || null,
    consent_data_sharing: a.consent,
    consent_at: consentAt,
  };
}
