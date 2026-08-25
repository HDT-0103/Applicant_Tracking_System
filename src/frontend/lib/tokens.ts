// Design token thuần dữ liệu — KHÔNG chứa JSX.
//
// Tách khỏi shared.tsx vì file đó có JSX nên vitest không parse được khi
// test chỉ muốn đọc giá trị token. Token là dữ liệu, không phải component.

/**
 * Bảng màu duy nhất của SmartATS.
 *
 * Trước đây app chạy song song HAI hệ màu: các trang dùng `D` lấy màu chính là
 * xanh dương #1B62F0, còn các trang dùng Tailwind hardcode màu chàm #4f46e5
 * (107 chỗ). Cùng một sản phẩm mà đổi màu thương hiệu khi chuyển trang. Nay
 * thống nhất về #4F46E5 — màu đã chiếm đa số và đã là `--primary` trong
 * globals.css.
 *
 * QUAN TRỌNG — giá trị phải là hex thật, KHÔNG được thay bằng `var(--x)`:
 * 14 file đang nối alpha vào token theo kiểu `${D.blue}28`. Đổi sang var()
 * sẽ tạo ra `var(--primary)28`, một chuỗi CSS vô nghĩa và trình duyệt bỏ qua
 * trong im lặng — màu biến mất mà không có lỗi nào.
 *
 * Bộ này phải khớp từng giá trị với `:root` trong app/globals.css.
 * `lib/__tests__/tokens.test.ts` canh việc đó, đừng sửa một bên rồi thôi.
 */
export const D = {
  // --- Nền, theo thứ tự từ xa tới gần người đọc ---
  bg: "#F7F8FA",
  canvas: "#FFFFFF",
  surface: "#FAFBFC",

  // --- Chữ, 4 mức tương phản ---
  ink: "#0F1117",
  sub: "#3D4451",
  muted: "#6B7280",
  dim: "#9CA3AF",

  // --- Đường kẻ ---
  line: "#E4E6EB",
  lineSoft: "#EEF0F4",

  // --- Màu chính (chàm) ---
  // Giữ tên `blue` vì 995 chỗ đang gọi tới. Đổi tên là một lượt sửa rời,
  // không gộp vào đợt thống nhất màu này.
  blue: "#4F46E5",
  blueSoft: "rgba(79,70,229,0.09)",
  blueMid: "rgba(79,70,229,0.18)",
  blueDeep: "#4338CA", // trạng thái nhấn/hover, thay cho #4338ca hardcode

  // --- Màu ngữ nghĩa ---
  mint: "#0D9E6F",
  mintSoft: "rgba(13,158,111,0.10)",
  purple: "#7C3AED",
  amber: "#D97706",
  red: "#DC2626",

  // --- Chữ ---
  // Inter nạp qua next/font trong app/layout.tsx và gắn vào biến này.
  // Trước đây khai 'Inter' ở đây nhưng không nơi nào nạp, nên suốt thời gian
  // qua app vẫn chạy bằng font hệ thống.
  font: "var(--font-inter), system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",

  // --- Bo góc ---
  r1: "6px",
  r2: "10px",
  r3: "14px",

  // --- Đổ bóng: mềm và nông, để bề mặt tách nhau mà không bị "nổi" giả tạo ---
  sh1: "0 1px 2px rgba(15,17,23,0.04)",
  sh2: "0 2px 8px rgba(15,17,23,0.06)",
  sh3: "0 8px 24px rgba(15,17,23,0.08)",

  // --- Chuyển động ---
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
};
