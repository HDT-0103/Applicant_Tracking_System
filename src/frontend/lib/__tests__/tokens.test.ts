/**
 * Canh cho hai hệ design token không lệch nhau.
 *
 * App tô màu bằng hai đường: inline style đọc object `D` (lib/shared.tsx) và
 * class Tailwind đọc biến CSS (`app/globals.css`). Hai nguồn cho cùng một thứ.
 *
 * Chúng ĐÃ từng lệch: `D.blue` là #1B62F0 còn `--primary` là #4f46e5, khiến
 * màu thương hiệu đổi theo trang. Không ai phát hiện vì cả hai đều "chạy được"
 * — chỉ là ra hai màu khác nhau. Test này biến kiểu lệch đó thành lỗi đỏ.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { D } from "../tokens";

const GLOBALS_CSS = readFileSync(
  join(__dirname, "..", "..", "app", "globals.css"),
  "utf-8",
);

/** Đọc giá trị một biến CSS trong khối `:root` đầu tiên. */
function cssVar(name: string): string | undefined {
  const match = GLOBALS_CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim().toLowerCase();
}

/**
 * So hai giá trị CSS theo đúng cách trình duyệt hiểu chúng.
 *
 * Bỏ qua hoa/thường (#4F46E5 ≡ #4f46e5) và khoảng trắng sau dấu phẩy
 * (`rgba(15,17,23,.04)` ≡ `rgba(15, 17, 23, .04)`). Hai khác biệt này thuần
 * hình thức; bắt lỗi vì chúng thì test chỉ gây phiền chứ không bảo vệ gì.
 */
function sameColor(a: string | undefined, b: string | undefined): boolean {
  const normalise = (value: string | undefined) =>
    value?.toLowerCase().replace(/\s+/g, "");
  return normalise(a) === normalise(b);
}

describe("design token: D (inline style) ↔ globals.css (Tailwind)", () => {
  const PAIRS: ReadonlyArray<[keyof typeof D, string]> = [
    ["blue", "primary"],
    ["blueDeep", "primary-hover"],
    ["ink", "foreground"],
    ["bg", "background"],
    ["canvas", "card"],
    ["muted", "muted-foreground"],
    ["line", "border"],
    ["red", "destructive"],
    ["r1", "radius-1"],
    ["r2", "radius-2"],
    ["r3", "radius-3"],
    ["sh1", "shadow-1"],
    ["sh2", "shadow-2"],
    ["sh3", "shadow-3"],
    ["ease", "ease"],
  ];

  it.each(PAIRS)("D.%s khớp với --%s", (tokenKey, varName) => {
    const fromCss = cssVar(varName);
    expect(fromCss, `globals.css thiếu biến --${varName}`).toBeDefined();
    expect(
      sameColor(String(D[tokenKey]), fromCss),
      `D.${String(tokenKey)} = ${String(D[tokenKey])} nhưng --${varName} = ${fromCss}`,
    ).toBe(true);
  });
});

describe("design token: tính toàn vẹn", () => {
  it("mọi màu đều là hex hoặc rgba, không phải var()", () => {
    // 14 file đang nối alpha vào token kiểu `${D.blue}28`. Nếu giá trị là
    // `var(--primary)` thì kết quả là `var(--primary)28` — chuỗi vô nghĩa,
    // trình duyệt bỏ qua và màu biến mất mà không báo lỗi.
    const colorKeys = ["bg", "canvas", "surface", "ink", "sub", "muted", "dim",
      "line", "lineSoft", "blue", "blueDeep", "mint", "purple", "amber", "red"] as const;

    for (const key of colorKeys) {
      expect(D[key], `D.${key} không được dùng var()`).not.toContain("var(");
      expect(D[key], `D.${key} phải là hex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("token nối alpha được phải là hex 6 ký tự", () => {
    // Chỉ hex 6 ký tự mới nối thêm 2 ký tự alpha thành hex 8 hợp lệ.
    for (const key of ["blue", "mint", "purple", "amber", "red"] as const) {
      expect(D[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("font trỏ tới biến do next/font cấp", () => {
    expect(D.font).toContain("--font-inter");
    // Phải có font dự phòng: lúc font chính chưa tải xong, chữ vẫn phải đọc được.
    expect(D.font).toContain("system-ui");
  });
});
