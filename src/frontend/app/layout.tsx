import type { Metadata } from "next";
import { WorkspaceProvider } from "../context/WorkspaceContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartATS — Ingestion & Verification",
  description: "AI-powered applicant tracking system with PDF ingestion and candidate analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
