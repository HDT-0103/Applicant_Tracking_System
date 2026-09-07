/**
 * @vitest-environment jsdom
 */
/**
 * Điểm khớp trên trang hồ sơ không được bịa: thiếu điểm thì nói "chưa chấm"
 * (bản cũ rơi về 89.5), và ba thanh "kinh nghiệm / kỹ năng / văn hoá" cứng
 * 93/87/81 đã bị thay bằng đối chiếu kỹ năng thật từ pipeline.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { MatchConfidence, isJobRelativeScore } from "../MatchConfidence";

afterEach(cleanup);

const analytics = (score: number, increase = 0) => ({
  match_confidence_score: score,
  score_increase: increase,
  semantic_tags: [],
  technical_skill_matrix: { pre_enrichment: [], post_enrichment: [] },
});

describe("MatchConfidence", () => {
  it("says 'not scored' instead of inventing a number", () => {
    render(<MatchConfidence analytics={null} />);
    expect(screen.getByText(/Not scored yet/)).toBeTruthy();
    expect(screen.queryByText("89.5")).toBeNull();
  });

  it("shows the job-relative score with the must-have breakdown when the pipeline ran", () => {
    render(
      <MatchConfidence
        analytics={analytics(85.19, 0.29)}
        skillMatrix={{ must_have: { matched: ["Python", "React"], missing: ["Go"] }, nice_to_have: { matched: [], missing: ["AWS"] } }}
      />,
    );
    expect(screen.getAllByText("85").length).toBeGreaterThan(0);
    expect(screen.getByText(/CV vs the job posting/)).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByText("0/1")).toBeTruthy();
    // Không còn thanh cứng.
    expect(screen.queryByText("93%")).toBeNull();
  });

  it("labels a keyword-only score as a signal, not a match with a posting", () => {
    render(<MatchConfidence analytics={analytics(99, 19.2)} skillMatrix={{ pre_enrichment: [1], post_enrichment: [2] }} />);
    expect(screen.getByText(/Technical signal from GitHub/)).toBeTruthy();
    expect(isJobRelativeScore({ pre_enrichment: [] })).toBe(false);
    expect(isJobRelativeScore({ must_have: {} })).toBe(true);
  });
});
