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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
