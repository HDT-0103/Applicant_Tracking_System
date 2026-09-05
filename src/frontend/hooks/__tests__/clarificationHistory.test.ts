import { describe, expect, it } from "vitest";
import { clarificationHistory } from "../useAgentChat";

describe("clarificationHistory — trả lời câu hỏi làm rõ phải mang theo yêu cầu gốc", () => {
  it("lấy tin người dùng ngay trước câu hỏi làm rõ", () => {
    expect(
      clarificationHistory([
        { role: "user", content: "find me a backend engineer" },
        { role: "assistant", content: "{}", clarification: true },
      ]),
    ).toEqual(["find me a backend engineer"]);
  });

  it("rỗng khi lượt trước là một câu trả lời thật hoặc một lỗi", () => {
    expect(
      clarificationHistory([
        { role: "user", content: "find me a backend engineer" },
        { role: "assistant", content: "{\"summary\":\"…\"}" },
      ]),
    ).toEqual([]);
    expect(
      clarificationHistory([
        { role: "user", content: "hello" },
        { role: "error", content: "boom" },
      ]),
    ).toEqual([]);
    expect(clarificationHistory([])).toEqual([]);
  });
});
