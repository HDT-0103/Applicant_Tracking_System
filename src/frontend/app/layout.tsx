import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Inter được khai trong design token từ lâu nhưng chưa bao giờ được nạp, nên
// app vẫn chạy bằng font hệ thống — trên macOS ra San Francisco, trên Windows
// ra Segoe UI, khoảng cách chữ và bề rộng khác nhau hẳn. next/font tự host
// file font (không gọi sang Google lúc chạy) và cấp sẵn biến CSS.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SmartATS — Ingestion & Verification",
  description:
    "AI-powered applicant tracking system with PDF ingestion and candidate analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body suppressHydrationWarning={true}>
        {/* Đặt data-theme TRƯỚC khi React chạy, nếu không trang tối sẽ loé
            trắng một nhịp ở mỗi lần tải. Cùng luật với ThemeContext: trang
            công khai luôn sáng. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;if(/^\/(login|register|careers)(\/|$)/.test(p))return;var t=localStorage.getItem("smartats_theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
