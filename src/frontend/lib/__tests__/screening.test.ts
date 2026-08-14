import { describe, expect, it } from "vitest";
import {
  MAX_RATED_SKILLS,
  type ScreeningAnswers,
  buildScreeningPayload,
  formatVnd,
  pickRatedSkills,
  screeningAnswersFromRow,
  toAmount,
  validateScreening,
} from "../screening";

const CONSENT_AT = "2026-07-22T00:00:00.000Z";
const SKILLS = ["React", "Node.js"];

/** A fully valid set of answers; each test perturbs one field. */
const valid = (over: Partial<ScreeningAnswers> = {}): ScreeningAnswers => ({
  salaryMin: "15,000,000",
  salaryMax: "20,000,000",
  salaryBasis: "gross",
  workModePref: ["hybrid"],
  availabilityBucket: "two_weeks",
  availabilityDate: "",
  skillRatings: { React: 4, "Node.js": 3 },
  workStyle: "collaborative",
  motivationReason: "",
  motivationOther: "",
  consent: true,
  ...over,
});

describe("formatVnd", () => {
  it("groups digits", () => {
    expect(formatVnd("15000000")).toBe("15,000,000");
  });

  it("strips non-digits so re-typing over a formatted value is stable", () => {
    expect(formatVnd("15,000,000")).toBe("15,000,000");
    expect(formatVnd("15tr000")).toBe("15,000");
  });

  it("returns an empty string for no digits", () => {
    expect(formatVnd("")).toBe("");
    expect(formatVnd("abc")).toBe("");
  });
});

describe("toAmount", () => {
  it("parses a grouped number", () => {
    expect(toAmount("15,000,000")).toBe(15000000);
  });

  it("returns null when empty so the column stays NULL", () => {
    expect(toAmount("")).toBeNull();
    expect(toAmount("   ")).toBeNull();
  });
});

describe("pickRatedSkills", () => {
  it("merges must-have and nice-to-have in order", () => {
    expect(pickRatedSkills({ must_have_skills: ["React"], nice_to_have_skills: ["Go"] }))
      .toEqual(["React", "Go"]);
  });

  it("drops duplicates across both lists", () => {
    expect(pickRatedSkills({ must_have_skills: ["React", "Go"], nice_to_have_skills: ["Go"] }))
      .toEqual(["React", "Go"]);
  });

  it("drops empty entries", () => {
    expect(pickRatedSkills({ must_have_skills: ["React", ""], nice_to_have_skills: null }))
      .toEqual(["React"]);
  });

  it("caps the list so the form stays usable", () => {
    const many = Array.from({ length: 30 }, (_, i) => `skill-${i}`);
    expect(pickRatedSkills({ must_have_skills: many })).toHaveLength(MAX_RATED_SKILLS);
  });

  it("handles a job with no skills at all", () => {
    expect(pickRatedSkills({})).toEqual([]);
  });
});

describe("validateScreening", () => {
  it("passes a complete set of answers", () => {
    expect(validateScreening(valid(), SKILLS)).toEqual({});
  });

  it("requires a salary range", () => {
    expect(validateScreening(valid({ salaryMin: "", salaryMax: "" }), SKILLS).salaryMax).toBeTruthy();
    expect(validateScreening(valid({ salaryMax: "" }), SKILLS).salaryMax).toBeTruthy();
    expect(validateScreening(valid({ salaryMin: "" }), SKILLS).salaryMax).toBeTruthy();
  });

  it("rejects a max below the min", () => {
    expect(validateScreening(valid({ salaryMin: "20,000,000", salaryMax: "15,000,000" }), SKILLS).salaryMax)
      .toBe("Maximum must be greater than the minimum");
  });

  it("allows min equal to max", () => {
    expect(validateScreening(valid({ salaryMin: "15,000,000", salaryMax: "15,000,000" }), SKILLS).salaryMax)
      .toBeUndefined();
  });

  it("requires at least one working arrangement", () => {
    expect(validateScreening(valid({ workModePref: [] }), SKILLS).workModePref).toBeTruthy();
  });

  it("requires an availability choice", () => {
    expect(validateScreening(valid({ availabilityBucket: "" }), SKILLS).availabilityBucket).toBeTruthy();
  });

  it("requires a date only when availability is 'other'", () => {
    expect(validateScreening(valid({ availabilityBucket: "other", availabilityDate: "" }), SKILLS).availabilityDate)
      .toBeTruthy();
    expect(validateScreening(valid({ availabilityBucket: "other", availabilityDate: "2026-09-01" }), SKILLS).availabilityDate)
      .toBeUndefined();
  });

  it("requires every listed skill to be rated", () => {
    const e = validateScreening(valid({ skillRatings: { React: 4 } }), SKILLS);
    expect(e.skillRatings).toContain("1 left");
  });

  it("treats a zero rating as unrated", () => {
    expect(validateScreening(valid({ skillRatings: { React: 4, "Node.js": 0 } }), SKILLS).skillRatings)
      .toBeTruthy();
  });

  it("skips the skill check when the job declared no skills", () => {
    expect(validateScreening(valid({ skillRatings: {} }), []).skillRatings).toBeUndefined();
  });

  it("requires a working style", () => {
    expect(validateScreening(valid({ workStyle: "" }), SKILLS).workStyle).toBeTruthy();
  });

  it("keeps the motivation question optional", () => {
    expect(validateScreening(valid({ motivationReason: "", motivationOther: "" }), SKILLS)).toEqual({});
  });

  it("blocks submission without consent", () => {
    expect(validateScreening(valid({ consent: false }), SKILLS).consent).toBeTruthy();
  });

  it("asks nothing about data a CV already carries", () => {
    // Guards the whole point of the redesign: no name/email/phone/school/experience.
    const asked = Object.keys(valid());
    for (const cvField of ["fullName", "email", "phone", "linkedin", "github",
                           "university", "educationLevel", "experienceBucket"]) {
      expect(asked).not.toContain(cvField);
    }
  });

  it("asks exactly five required questions plus consent", () => {
    const errs = validateScreening({
      salaryMin: "", salaryMax: "", salaryBasis: "", workModePref: [],
      availabilityBucket: "", availabilityDate: "", skillRatings: {}, workStyle: "",
      motivationReason: "", motivationOther: "", consent: false,
    }, SKILLS);
    expect(Object.keys(errs).sort()).toEqual(
      ["availabilityBucket", "consent", "salaryMax", "skillRatings", "workModePref", "workStyle"].sort(),
    );
  });
});

describe("buildScreeningPayload", () => {
  it("maps a full answer set onto the applications columns", () => {
    expect(buildScreeningPayload(valid({ motivationReason: "growth", motivationOther: "Relocating" }), CONSENT_AT))
      .toEqual({
        expected_salary_min: 15000000,
        expected_salary_max: 20000000,
        salary_basis: "gross",
        work_mode_pref: ["hybrid"],
        availability_bucket: "two_weeks",
        availability_date: null,
        skill_ratings: { React: 4, "Node.js": 3 },
        motivation_reason: "growth",
        motivation_other: "Relocating",
        work_style: "collaborative",
        consent_data_sharing: true,
        consent_at: CONSENT_AT,
      });
  });

  it("keeps the date only for the 'other' bucket", () => {
    expect(buildScreeningPayload(valid({ availabilityBucket: "immediate", availabilityDate: "2026-09-01" }), CONSENT_AT)
      .availability_date).toBeNull();
    expect(buildScreeningPayload(valid({ availabilityBucket: "other", availabilityDate: "2026-09-01" }), CONSENT_AT)
      .availability_date).toBe("2026-09-01");
  });

  it("drops unrated skills instead of storing zeros", () => {
    expect(buildScreeningPayload(valid({ skillRatings: { React: 4, Go: 0 } }), CONSENT_AT).skill_ratings)
      .toEqual({ React: 4 });
  });

  it("sends null rather than empty strings", () => {
    const payload = buildScreeningPayload(
      valid({ salaryMin: "", salaryMax: "", motivationReason: "", motivationOther: "   " }),
      CONSENT_AT,
    );
    expect(payload.expected_salary_min).toBeNull();
    expect(payload.expected_salary_max).toBeNull();
    expect(payload.motivation_reason).toBeNull();
    expect(payload.motivation_other).toBeNull();
  });

  it("keeps free text even when no reason chip was picked", () => {
    expect(buildScreeningPayload(valid({ motivationReason: "", motivationOther: "Burned out" }), CONSENT_AT)
      .motivation_other).toBe("Burned out");
  });

  it("records the consent flag as given", () => {
    expect(buildScreeningPayload(valid({ consent: false }), CONSENT_AT).consent_data_sharing).toBe(false);
    expect(buildScreeningPayload(valid(), CONSENT_AT).consent_data_sharing).toBe(true);
  });
});

describe("screeningAnswersFromRow", () => {
  it("round-trips a payload back into the same answers", () => {
    const answers = valid({ availabilityBucket: "other", availabilityDate: "2026-09-01" });
    const row = buildScreeningPayload(answers, CONSENT_AT);
    expect(screeningAnswersFromRow(row)).toEqual(answers);
  });

  it("formats stored salary numbers for the inputs", () => {
    const a = screeningAnswersFromRow({ expected_salary_min: 15000000, expected_salary_max: 20000000 });
    expect(a.salaryMin).toBe("15,000,000");
    expect(a.salaryMax).toBe("20,000,000");
  });

  it("falls back to safe defaults on an empty or malformed row", () => {
    const a = screeningAnswersFromRow({ work_mode_pref: "hybrid", skill_ratings: [1, 2] });
    expect(a.salaryBasis).toBe("gross");
    expect(a.workModePref).toEqual([]);
    expect(a.skillRatings).toEqual({});
    expect(a.consent).toBe(false);
  });
});
