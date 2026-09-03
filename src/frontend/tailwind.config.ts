import type { Config } from "tailwindcss";

// Config này phải nằm CÙNG thư mục với app Next, không phải ở gốc repo.
//
// PostCSS dò file cấu hình từ THƯ MỤC LÀM VIỆC, không phải từ thư mục dự án
// truyền cho `next build`. Đặt ở gốc thì chỉ đúng khi build từ gốc; trên
// Vercel (Root Directory = src/frontend) Tailwind sẽ không được nạp và toàn bộ
// class tiện ích biến mất — trang vẫn build xanh, chỉ mất sạch layout.
// Mọi script build đều chạy với cwd = src/frontend, xem package.json ở gốc.
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Dạng `rgb(var(--x) / <alpha-value>)` để `bg-primary/10` hoạt động.
        // Nếu để `var(--primary)` (hex) thì class không độ mờ vẫn chạy, còn
        // class có độ mờ hỏng lặng lẽ — sinh ra CSS không hợp lệ, trình duyệt
        // bỏ qua, và phần tử mất nền mà không có lỗi nào.
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          hover: "rgb(var(--primary-hover-rgb) / <alpha-value>)",
          foreground: "var(--primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          accent: "var(--sidebar-accent)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
