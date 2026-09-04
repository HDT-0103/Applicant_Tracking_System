"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { RequireCalendarModal } from "@/components/RequireCalendarModal";
import { AgentChatProvider } from "@/hooks/useAgentChat";
import { AgentChatDrawer } from "@/components/AgentChatDrawer";

export function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={clientId || ""}>
      <AuthProvider>
        <AuthGuard>
          <WorkspaceProvider>
            <AgentChatProvider>
              {children}
              <AgentChatDrawer />
            </AgentChatProvider>
            {/* <RequireCalendarModal /> */}
            </WorkspaceProvider>
        </AuthGuard>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
