/**
 * Canh cho hệ design token không gãy khi đổi theme.
 *
 * Mọi màu trong `D` là `var(--x)` trỏ vào app/globals.css. Bảng sáng ở `:root`,
 * bảng tối ở `[data-theme="dark"]`. Một biến có ở bảng này mà thiếu ở bảng kia
 * thì khi đổi theme màu đó giữ nguyên — nền đổi sang tối mà chữ vẫn đen, và
 * không có lỗi nào báo.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { D, tint } from "../tokens";

const GLOBALS_CSS = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf-8");

function block(selector: string): string {
  const start = GLOBALS_CSS.indexOf(`${selector} {`);
  expect(start, `globals.css thiếu khối ${selector}`).toBeGreaterThan(-1);
  return GLOBALS_CSS.slice(start, GLOBALS_CSS.indexOf("}", start));
}
const LIGHT = block(":root");
const DARK = block('[data-theme="dark"]');

const varsIn = (value: string): string[] =>
  Array.from(value.matchAll(/var\((--[a-z0-9-]+)\)/g)).map((m) => m[1]);

const COLOR_KEYS = ["bg", "canvas", "surface", "ink", "sub", "muted", "dim", "line", "lineSoft",
  "blue", "blueSoft", "blueMid", "blueDeep", "mint", "mintSoft", "purple", "amber", "red"] as const;

describe("design token: D ↔ globals.css", () => {
  it.each(COLOR_KEYS)("D.%s trỏ tới biến có ở CẢ bảng sáng lẫn bảng tối", (key) => {
    const names = varsIn(D[key]);
    expect(names.length, `D.${key} phải là var(--x)`).toBeGreaterThan(0);
    for (const name of names) {
      expect(LIGHT, `:root thiếu ${name}`).toContain(`${name}:`);
      expect(DARK, `[data-theme="dark"] thiếu ${name}`).toContain(`${name}:`);
    }
  });

  it("không còn hex cứng trong token màu — nếu không theme tối không đổi được nó", () => {
    for (const key of COLOR_KEYS) expect(D[key]).not.toMatch(/^#/);
  });

  it("font trỏ tới biến do next/font cấp, kèm dự phòng", () => {
    expect(D.font).toContain("--font-inter");
    expect(D.font).toContain("system-ui");
  });
});

describe("tint — thay cho kiểu nối alpha `${D.blue}28`", () => {
  // `var(--primary)28` là chuỗi CSS vô nghĩa; trình duyệt bỏ qua trong im lặng.
  it("dựng rgb(var(--x-rgb) / a) từ 2 ký tự hex", () => {
    expect(tint("blue", "28")).toBe("rgb(var(--primary-rgb) / 0.157)");
    expect(tint("red", "FF")).toBe("rgb(var(--destructive-rgb) / 1)");
  });

  it("nhận cả số 0–1", () => {
    expect(tint("mint", 0.5)).toBe("rgb(var(--mint-rgb) / 0.5)");
  });

  it("mọi biến -rgb nó dùng đều có ở cả hai bảng", () => {
    for (const key of ["blue", "mint", "purple", "amber", "red"] as const) {
      for (const name of varsIn(tint(key, "10"))) {
        expect(LIGHT).toContain(`${name}:`);
        expect(DARK).toContain(`${name}:`);
      }
    }
  });
});
