"use client";

import React from "react";
import { useRouter } from 'next/navigation';
import { AppHeader } from "../components/AppHeader";
import { IdleUploadZone } from "../components/IdleUploadZone";
import { AiAnalyticsWorkspace } from "../components/AiAnalyticsWorkspace";
import { FallbackDataWizard } from "../components/FallbackDataWizard";
import { PdfToolbar } from "../components/PdfToolbar";
import { SkeletonLoadingSpinner } from "../components/SkeletonLoadingSpinner";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { D } from "../lib/shared";

export default function HomePage() {
  const router = useRouter();
  const { status, pdfUrl, analyticData, errorMessage, uploadResume, resetWorkspace } = useWorkspace();
  const fileName = "resume.pdf";

  const handleRunSync = () => {
    router.push("/candidate-profile/enriched");
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader onRunSync={status === "SUCCESS" ? handleRunSync : undefined} />
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
        {status === "SUCCESS" && analyticData && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <PdfToolbar fileName={fileName} pdfUrl={pdfUrl} />
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div style={{ width: "50%", height: "100%", borderRight: `1px solid ${D.line}` }}>
                {pdfUrl && <iframe src={pdfUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Candidate Resume" />}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <AiAnalyticsWorkspace data={analyticData} onReset={resetWorkspace} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
