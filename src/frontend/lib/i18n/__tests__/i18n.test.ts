import { describe, expect, it } from "vitest";
import { MESSAGES, MESSAGE_GROUPS } from "../messages";
import { translate } from "../index";

describe("từ điển i18n", () => {
  it("mọi key đều có cả tiếng Anh lẫn tiếng Việt, không rỗng", () => {
    const missing: string[] = [];
    for (const [key, m] of Object.entries(MESSAGES)) {
      if (!m.en?.trim()) missing.push(`${key}.en`);
      if (!m.vi?.trim()) missing.push(`${key}.vi`);
    }
    expect(missing).toEqual([]);
  });

  it("không có key trùng giữa các namespace — key sau sẽ đè key trước trong im lặng", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [ns, group] of Object.entries(MESSAGE_GROUPS)) {
      for (const key of Object.keys(group)) {
        if (seen.has(key)) dupes.push(`${key} (${seen.get(key)} & ${ns})`);
        seen.set(key, ns);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("biến nội suy giống nhau ở hai ngôn ngữ", () => {
    const off: string[] = [];
    for (const [key, m] of Object.entries(MESSAGES)) {
      const vars = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(",");
      if (vars(m.en) !== vars(m.vi)) off.push(key);
    }
    expect(off).toEqual([]);
  });
});

describe("translate", () => {
  it("nội suy biến và rơi về tiếng Anh khi thiếu bản dịch", () => {
    expect(translate("vi", "time.minutesAgo", { n: 5 })).toBe("5 phút trước");
    expect(translate("en", "time.minutesAgo", { n: 5 })).toBe("5m ago");
  });

  it("thiếu key thì trả về chính key để nhìn ra trên màn hình", () => {
    expect(translate("en", "nope.missing")).toBe("nope.missing");
  });
});
