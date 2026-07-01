"use client";

import React, { useEffect } from "react";
import { useRouter } from 'next/navigation';
import { AppHeader } from "../components/AppHeader";
import { IdleUploadZone } from "../components/IdleUploadZone";
import { FallbackDataWizard } from "../components/FallbackDataWizard";
import { SkeletonLoadingSpinner } from "../components/SkeletonLoadingSpinner";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { D } from "../lib/shared";

export default function HomePage() {
  const router = useRouter();
  const { status, errorMessage, uploadResume, resetWorkspace, candidateUuid } = useWorkspace();

  // After upload, immediately redirect to enriched page for WebSocket live updates
  useEffect(() => {
    if (status === "SUCCESS" && candidateUuid) {
      router.push(`/candidate-profile/enriched?uuid=${candidateUuid}`);
    }
  }, [status, candidateUuid, router]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader />
      <main style={{ flex: 1, overflow: "hidden", background: D.bg }}>
        {status === "IDLE" && <IdleUploadZone onFileDrop={uploadResume} />}
        {status === "LOADING" && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SkeletonLoadingSpinner />
          </div>
        )}
        {status === "ERROR" && (
          <div style={{ height: "100%" }}>
            <FallbackDataWizard error={errorMessage} onRetry={resetWorkspace} />
          </div>
        )}
        {status === "SUCCESS" && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SkeletonLoadingSpinner />
          </div>
        )}
      </main>
    </div>
  );
}
