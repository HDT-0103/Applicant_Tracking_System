import { describe, expect, it } from "vitest";

import { parseSkillMatrix } from "../skillMatrix";

const FULL = {
  must_have: { matched: ["Python", "FastAPI"], missing: ["Kubernetes"] },
  nice_to_have: { matched: ["Go"], missing: ["Rust"] },
  must_have_coverage: 0.6667,
  extra_skills: ["Terraform"],
};

describe("parseSkillMatrix", () => {
  it("reads every group", () => {
    const m = parseSkillMatrix(FULL)!;
    expect(m.mustHave.matched).toEqual(["Python", "FastAPI"]);
    expect(m.mustHave.missing).toEqual(["Kubernetes"]);
    expect(m.mustHave.total).toBe(3);
    expect(m.niceToHave.matched).toEqual(["Go"]);
    expect(m.extra).toEqual(["Terraform"]);
  });

  it("recomputes coverage rather than trusting the stored value", () => {
    // The stored figure can be stale: a posting's requirements may have changed
    // after the profile was last enriched.
    const m = parseSkillMatrix({ ...FULL, must_have_coverage: 0.99 })!;
    expect(m.coverage).toBeCloseTo(2 / 3, 4);
  });

  it("coverage is null when the posting names no required skills", () => {
    // Not 0 — zero reads as "matched nothing", when in fact there was no
    // criterion to match against.
    const m = parseSkillMatrix({
      must_have: { matched: [], missing: [] },
      extra_skills: ["Go"],
    })!;
    expect(m.coverage).toBeNull();
  });

  it("full coverage", () => {
    const m = parseSkillMatrix({
      must_have: { matched: ["Python"], missing: [] },
    })!;
    expect(m.coverage).toBe(1);
    expect(m.mustHave.total).toBe(1);
  });

  it("no coverage at all", () => {
    const m = parseSkillMatrix({
      must_have: { matched: [], missing: ["Python", "Go"] },
    })!;
    expect(m.coverage).toBe(0);
  });
});

describe("parseSkillMatrix — nothing to show", () => {
  it("returns null when enrichment has not run", () => {
    expect(parseSkillMatrix(null)).toBeNull();
    expect(parseSkillMatrix(undefined)).toBeNull();
  });

  it("returns null for an empty object rather than an empty panel", () => {
    expect(parseSkillMatrix({})).toBeNull();
  });

  it("returns null when every group is empty", () => {
    expect(
      parseSkillMatrix({
        must_have: { matched: [], missing: [] },
        nice_to_have: { matched: [], missing: [] },
        extra_skills: [],
      }),
    ).toBeNull();
  });

  it("survives malformed input without throwing", () => {
    // The shape comes from the backend; a mismatch must degrade to an empty
    // panel, not a crashed page.
    expect(parseSkillMatrix("a string")).toBeNull();
    expect(parseSkillMatrix(42)).toBeNull();
    expect(parseSkillMatrix([1, 2, 3])).toBeNull();
    expect(parseSkillMatrix({ must_have: "not an object" })).toBeNull();
  });

  it("ignores non-string and blank entries", () => {
    const m = parseSkillMatrix({
      must_have: { matched: ["Python", "", "  ", null, 7], missing: [] },
    })!;
    expect(m.mustHave.matched).toEqual(["Python"]);
    expect(m.mustHave.total).toBe(1);
  });

  it("trims surrounding whitespace", () => {
    const m = parseSkillMatrix({
      must_have: { matched: ["  Python  "], missing: [] },
    })!;
    expect(m.mustHave.matched).toEqual(["Python"]);
  });
});
