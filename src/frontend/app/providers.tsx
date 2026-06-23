"use client";

import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "../context/AuthContext";
import { WorkspaceProvider } from "../context/WorkspaceContext";
import { AuthGuard } from "../src/components/AuthGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <WorkspaceProvider>
          <AuthGuard>{children}</AuthGuard>
        </WorkspaceProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
