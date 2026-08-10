import { describe, expect, it } from "vitest";
import { buildJobPath, buildJobUrl, parseJobId, slugifyJobTitle } from "../jobUrl";

const ID = "3f9a2b1c-4d5e-4f6a-8b9c-0d1e2f3a4b5c";

describe("slugifyJobTitle", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyJobTitle("Senior ML Engineer")).toBe("senior-ml-engineer");
  });

  it("strips Vietnamese diacritics and đ", () => {
    expect(slugifyJobTitle("Kỹ sư Dữ liệu (Cấp cao)")).toBe("ky-su-du-lieu-cap-cao");
  });

  it("collapses punctuation runs and trims edges", () => {
    expect(slugifyJobTitle("  ///Back-end   Engineer!!!  ")).toBe("back-end-engineer");
  });

  it("never leaves a trailing hyphen after truncation", () => {
    const slug = slugifyJobTitle("a".repeat(59) + " tail");
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugifyJobTitle("！！！")).toBe("");
  });
});

describe("buildJobPath", () => {
  it("appends the id after the slug", () => {
    expect(buildJobPath(ID, "Senior ML Engineer")).toBe(`/careers/senior-ml-engineer-${ID}`);
  });

  it("falls back to the bare id when the title yields no slug", () => {
    expect(buildJobPath(ID, "")).toBe(`/careers/${ID}`);
    expect(buildJobPath(ID, "###")).toBe(`/careers/${ID}`);
  });
});

describe("buildJobUrl", () => {
  it("returns the path when there is no window (SSR)", () => {
    expect(buildJobUrl(ID, "Senior ML Engineer")).toBe(`/careers/senior-ml-engineer-${ID}`);
  });
});

describe("parseJobId", () => {
  it("round-trips whatever buildJobPath produced", () => {
    const slug = buildJobPath(ID, "Senior ML Engineer").replace("/careers/", "");
    expect(parseJobId(slug)).toBe(ID);
  });

  it("accepts a bare uuid", () => {
    expect(parseJobId(ID)).toBe(ID);
  });

  it("accepts a url-encoded slug", () => {
    expect(parseJobId(encodeURIComponent(`senior-ml-engineer-${ID}`))).toBe(ID);
  });

  it("normalises case", () => {
    expect(parseJobId(`role-${ID.toUpperCase()}`)).toBe(ID);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseJobId(`  role-${ID}  `)).toBe(ID);
  });

  it("returns null for a legacy title-only slug", () => {
    expect(parseJobId("Senior ML Engineer")).toBeNull();
    expect(parseJobId("senior-ml-engineer")).toBeNull();
  });

  it("returns null for a uuid that is not at the end", () => {
    expect(parseJobId(`${ID}-trailing`)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseJobId(null)).toBeNull();
    expect(parseJobId(undefined)).toBeNull();
    expect(parseJobId("")).toBeNull();
  });

  it("does not match a malformed uuid", () => {
    expect(parseJobId("role-3f9a2b1c-4d5e-4f6a-8b9c-0d1e2f3a4b")).toBeNull();
  });
});
