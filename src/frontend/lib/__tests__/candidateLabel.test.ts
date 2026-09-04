import { describe, expect, it } from "vitest";

import {
  anonymousCandidateLabel,
  appliedForLabel,
  candidateDisplayName,
  candidateInitials,
  isMasked,
} from "../candidateLabel";

const UUID = "1a2b3c4d-0000-4000-8000-000000000000";

describe("candidateDisplayName — một nhãn chung cho mọi role", () => {
  it("giữ tên thật khi HR đọc được", () => {
    expect(candidateDisplayName("Trần Bảo", UUID)).toBe("Trần Bảo");
  });

  // Đây là lỗi đã có trên dashboard: "***" là chuỗi truthy nên `||` không
  // rơi vào fallback, heading hiện đúng ba dấu sao cho MỌI hồ sơ.
  it("thay '***' bị ABAC che bằng nhãn ẩn danh theo uuid", () => {
    expect(candidateDisplayName("***", UUID)).toBe("Candidate #1a2b3c4d");
  });

  it("hồ sơ chưa có tên cũng dùng nhãn ẩn danh, không phải 'Unknown'", () => {
    expect(candidateDisplayName(null, UUID)).toBe("Candidate #1a2b3c4d");
    expect(candidateDisplayName("   ", UUID)).toBe("Candidate #1a2b3c4d");
  });

  it("không có uuid thì vẫn ra chữ chứ không ra 'Candidate #'", () => {
    expect(anonymousCandidateLabel(undefined)).toBe("Candidate");
  });
});

describe("candidateInitials — avatar phải khác nhau giữa các hồ sơ bị che", () => {
  it("tên thật lấy chữ đầu mỗi từ", () => {
    expect(candidateInitials("Trần Bảo", UUID)).toBe("TB");
  });

  it("bị che thì lấy 2 ký tự đầu uuid thay vì '**'", () => {
    expect(candidateInitials("***", UUID)).toBe("1A");
  });
});

describe("appliedForLabel — tin tuyển dụng không được đọc thành chức danh", () => {
  it("ghi rõ 'Applying for' trước tên tin", () => {
    expect(appliedForLabel("Senior Backend Engineer")).toBe(
      "Applying for: Senior Backend Engineer",
    );
  });

  it("thiếu tin thì là ứng tuyển chung", () => {
    expect(appliedForLabel(null)).toBe("General application");
    expect(appliedForLabel("***")).toBe("General application");
  });
});

describe("isMasked", () => {
  it("chỉ đúng với chuỗi '***'", () => {
    expect(isMasked("***")).toBe(true);
    expect(isMasked("** *")).toBe(false);
    expect(isMasked(null)).toBe(false);
  });
});
