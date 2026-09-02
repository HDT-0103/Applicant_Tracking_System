import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../httpClient", () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

import { MASKED, isMasked, searchCandidates } from "../searchService";

describe("searchService", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ results: [], total: 0, min_score: 0 });
  });

  it("sends the query to the search endpoint", async () => {
    await searchCandidates({ summary: "Senior Python engineer", top_k: 5 });
    expect(post).toHaveBeenCalledWith("/api/search", {
      summary: "Senior Python engineer",
      top_k: 5,
    });
  });

  it("passes required skills through as the hard filter", async () => {
    await searchCandidates({ summary: "x", required_skills: ["Python", "Docker"] });
    expect(post.mock.calls[0][1].required_skills).toEqual(["Python", "Docker"]);
  });

  it("recognises a masked field", () => {
    // Backend trả đúng chuỗi này cho trường bị che; giao diện phải phân biệt
    // được "bị che vì chính sách" với "dữ liệu rỗng".
    expect(isMasked(MASKED)).toBe(true);
    expect(isMasked("Senior backend engineer")).toBe(false);
    expect(isMasked(null)).toBe(false);
    expect(isMasked("")).toBe(false);
  });
});
