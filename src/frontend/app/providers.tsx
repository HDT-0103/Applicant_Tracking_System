"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"; // Đã sửa lại đường dẫn ở đây

export function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={clientId || ""}>
      <AuthProvider>
        <AuthGuard>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </AuthGuard>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}