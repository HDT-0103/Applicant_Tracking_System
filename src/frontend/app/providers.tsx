"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"; // Đã sửa lại đường dẫn ở đây

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </AuthGuard>
    </AuthProvider>
  );
}