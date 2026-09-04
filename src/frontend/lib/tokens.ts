// Design token thuần dữ liệu — KHÔNG chứa JSX.
//
// Tách khỏi shared.tsx vì file đó có JSX nên vitest không parse được khi
// test chỉ muốn đọc giá trị token. Token là dữ liệu, không phải component.

/**
 * Bảng màu duy nhất của SmartATS — nay là BIẾN CSS, không còn hex cứng.
 *
 * Mọi giá trị màu trỏ tới một biến khai trong app/globals.css. Bảng sáng nằm
 * ở `:root`, bảng tối ở `[data-theme="dark"]`; đổi theme chỉ là đổi thuộc
 * tính trên <html> (contexts/ThemeContext.tsx), 995 chỗ đang đọc `D.*` qua
 * inline style tự đổi theo mà không phải sửa dòng nào.
 *
 * Hệ quả bắt buộc: KHÔNG được nối alpha vào token kiểu `${D.blue}28` nữa —
 * `var(--primary)28` là chuỗi CSS vô nghĩa, trình duyệt bỏ qua trong im lặng
 * và màu biến mất mà không có lỗi. Dùng `tint("blue", "28")` bên dưới; nó
 * dựng `rgb(var(--primary-rgb) / 0.157)` từ kênh RGB tách sẵn.
 * `lib/__tests__/tokens.test.ts` canh: mỗi biến phải có ở CẢ HAI bảng.
 */
export const D = {
  // --- Nền, theo thứ tự từ xa tới gần người đọc ---
  bg: "var(--background)",
  canvas: "var(--card)",
  surface: "var(--surface)",

  // --- Chữ, 4 mức tương phản ---
  ink: "var(--foreground)",
  sub: "var(--ink-sub)",
  muted: "var(--muted-foreground)",
  dim: "var(--ink-dim)",

  // --- Đường kẻ ---
  line: "var(--border)",
  lineSoft: "var(--border-soft)",

  // --- Màu chính (chàm) ---
  // Giữ tên `blue` vì 995 chỗ đang gọi tới. Đổi tên là một lượt sửa rời,
  // không gộp vào đợt này.
  blue: "var(--primary)",
  blueSoft: "rgb(var(--primary-rgb) / 0.09)",
  blueMid: "rgb(var(--primary-rgb) / 0.18)",
  blueDeep: "var(--primary-hover)", // trạng thái nhấn/hover

  // --- Màu ngữ nghĩa ---
  mint: "var(--mint)",
  mintSoft: "rgb(var(--mint-rgb) / 0.10)",
  purple: "var(--purple)",
  amber: "var(--amber)",
  red: "var(--destructive)",

  // --- Chữ ---
  // Inter nạp qua next/font trong app/layout.tsx và gắn vào biến này.
  font: "var(--font-inter), system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",

  // --- Bo góc ---
  r1: "var(--radius-1)",
  r2: "var(--radius-2)",
  r3: "var(--radius-3)",

  // --- Đổ bóng ---
  sh1: "var(--shadow-1)",
  sh2: "var(--shadow-2)",
  sh3: "var(--shadow-3)",

  // --- Chuyển động ---
  ease: "var(--ease)",
};

/** Token có kênh RGB tách sẵn (`--x-rgb`) nên pha được độ mờ. */
export type TintableToken = "blue" | "mint" | "purple" | "amber" | "red";

const RGB_VAR: Record<TintableToken, string> = {
  blue: "--primary-rgb",
  mint: "--mint-rgb",
  purple: "--purple-rgb",
  amber: "--amber-rgb",
  red: "--destructive-rgb",
};

/**
 * Màu token pha độ mờ. `alpha` là 2 ký tự hex như cách viết cũ (`"28"` ≈ 16%)
 * để codemod thay `${D.blue}28` thành `${tint("blue", "28")}` mà không phải
 * tính lại từng chỗ; cũng nhận số 0–1.
 */
export function tint(token: TintableToken, alpha: string | number): string {
  const a = typeof alpha === "number" ? alpha : parseInt(alpha, 16) / 255;
  return `rgb(var(${RGB_VAR[token]}) / ${Math.round(a * 1000) / 1000})`;
}
