import { describe, expect, it } from "vitest";

import {
  candidateContext,
  firstOf,
  readMustHave,
  topLanguages,
} from "../candidateSummary";

describe("firstOf — hình dạng quan hệ của PostgREST", () => {
  // Đây chính là lỗi đã có sẵn trên trang chủ: code viết `?.[0]` cho cả ba
  // quan hệ, nhưng PostgREST trả object cho quan hệ một-một. Kết quả luôn
  // undefined, nên trạng thái enrich và điểm khớp không bao giờ hiện ra.
  it("lấy phần tử đầu khi là mảng (applications)", () => {
    expect(firstOf([{ id: "a" }, { id: "b" }])).toEqual({ id: "a" });
  });

  it("trả về chính nó khi là object (enrichment_profiles, github_profiles)", () => {
    expect(firstOf({ id: "a" })).toEqual({ id: "a" });
  });

  it("mảng rỗng cho ra undefined chứ không ném lỗi", () => {
    expect(firstOf([])).toBeUndefined();
  });

  it("null và undefined đều cho ra undefined", () => {
    expect(firstOf(null)).toBeUndefined();
    expect(firstOf(undefined)).toBeUndefined();
  });
});

describe("readMustHave — độ khớp kỹ năng bắt buộc", () => {
  it("đếm đúng số khớp và tổng", () => {
    expect(
      readMustHave({ must_have: { matched: ["Python", "Go"], missing: ["Rust"] } }),
    ).toEqual({ matched: 2, total: 3 });
  });

  it("khớp đủ", () => {
    expect(readMustHave({ must_have: { matched: ["Python"], missing: [] } })).toEqual({
      matched: 1,
      total: 1,
    });
  });

  it("JD không khai kỹ năng bắt buộc -> null, KHÔNG phải 0/0", () => {
    // "0/0 kỹ năng" trông như ứng viên không khớp gì, trong khi thực tế là
    // không có tiêu chí nào để đo.
    expect(readMustHave({ must_have: { matched: [], missing: [] } })).toBeNull();
  });

  it("skill_matrix chưa được pipeline ghi -> null", () => {
    expect(readMustHave(null)).toBeNull();
    expect(readMustHave(undefined)).toBeNull();
    expect(readMustHave({})).toBeNull();
  });

  it("dữ liệu méo mó không làm vỡ giao diện", () => {
    // Không ném lỗi, và không hiện chip rỗng — cả hai đều trả null.
    expect(readMustHave("chuoi la")).toBeNull();
    expect(readMustHave(42)).toBeNull();
    expect(readMustHave({ must_have: "khong-phai-object" })).toBeNull();
    expect(readMustHave({ must_have: { matched: "x", missing: null } })).toBeNull();
  });
});

describe("topLanguages — ngôn ngữ GitHub nổi bật", () => {
  it("xếp theo tỷ trọng giảm dần", () => {
    expect(topLanguages({ HTML: 16.6, "Jupyter Notebook": 77.0, C: 4.1 })).toEqual([
      "Jupyter Notebook",
      "HTML",
      "C",
    ]);
  });

  it("cắt còn tối đa 3 để không tràn hàng", () => {
    expect(
      topLanguages({ A: 5, B: 4, C: 3, D: 2, E: 1 }),
    ).toEqual(["A", "B", "C"]);
  });

  it("đổi được số lượng khi cần", () => {
    expect(topLanguages({ A: 5, B: 4, C: 3 }, 2)).toEqual(["A", "B"]);
  });

  it("ứng viên chưa có GitHub -> mảng rỗng", () => {
    expect(topLanguages(null)).toEqual([]);
    expect(topLanguages({})).toEqual([]);
  });

  it("mảng hoặc chuỗi không bị hiểu nhầm thành từ điển ngôn ngữ", () => {
    expect(topLanguages(["Go"])).toEqual([]);
    expect(topLanguages("Go")).toEqual([]);
  });

  it("bỏ qua tỷ trọng không phải số", () => {
    expect(topLanguages({ Go: 10, Bad: "x" as unknown as number })).toEqual(["Go"]);
  });
});

describe("candidateContext — dòng 'Công ty · Địa điểm'", () => {
  it("ghép đủ hai vế", () => {
    expect(candidateContext("Tech Corp", "Hà Nội")).toBe("Tech Corp · Hà Nội");
  });

  it("thiếu công ty thì không để lại dấu chấm mồ côi", () => {
    expect(candidateContext(null, "Hà Nội")).toBe("Hà Nội");
  });

  it("thiếu địa điểm", () => {
    expect(candidateContext("Tech Corp", null)).toBe("Tech Corp");
  });

  it("thiếu cả hai -> null để giao diện bỏ hẳn dòng", () => {
    expect(candidateContext(null, null)).toBeNull();
  });

  it("chuỗi rỗng hoặc toàn khoảng trắng cũng coi như thiếu", () => {
    expect(candidateContext("", "   ")).toBeNull();
    expect(candidateContext("  ", "Hà Nội")).toBe("Hà Nội");
  });
});
