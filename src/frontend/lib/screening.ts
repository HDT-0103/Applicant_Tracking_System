// --- Applicant screening questionnaire ---------------------------------------
// Only asks what a CV cannot tell us. Name, email, phone, social links, school
// and years of experience are extracted from the uploaded CV instead, so the
// form stays down to five questions on a single page.
//
// Kept free of React so it can be unit-tested without rendering the form.

export type Choice = { value: string; label: string; hint?: string };

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
 */
export function validateScreening(
  a: ScreeningAnswers,
  requiredSkills: string[] = [],
): ScreeningErrors {
  const e: ScreeningErrors = {};

  const min = toAmount(a.salaryMin);
  const max = toAmount(a.salaryMax);
  if (min === null || max === null) e.salaryMax = "Please give your expected range";
  else if (max < min) e.salaryMax = "Maximum must be greater than the minimum";

  if (!a.workModePref.length) e.workModePref = "Select at least one working arrangement";

  if (!a.availabilityBucket) e.availabilityBucket = "Please select when you can start";
  if (a.availabilityBucket === "other" && !a.availabilityDate)
    e.availabilityDate = "Please specify your start date";

  const unrated = requiredSkills.filter((s) => !a.skillRatings[s]);
  if (unrated.length)
    e.skillRatings = `Please rate all ${requiredSkills.length} skills (${unrated.length} left)`;

  if (!a.workStyle) e.workStyle = "Please select your preferred working style";

  if (!a.consent) e.consent = "We need your consent to process this application";

  return e;
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
