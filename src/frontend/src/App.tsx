"use client";

import React from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { IdleUploadZone } from "./components/IdleUploadZone";
import { PdfToolbar } from "./components/PdfToolbar";
import { AiAnalyticsWorkspace } from "./components/AiAnalyticsWorkspace";
import { SkeletonLoadingSpinner } from "./components/SkeletonLoadingSpinner";
import { FallbackDataWizard } from "./components/FallbackDataWizard";

export default function App() {
  const {
    status,
    pdfUrl,
    analyticData,
    errorMessage,
    uploadResume,
    resetWorkspace,
  } = useWorkspace();

  /* ── IDLE: Show drop zone ── */
  if (status === "IDLE") {
    return <IdleUploadZone onFileDrop={uploadResume} />;
  }

  /* ── ERROR: Show error wizard ── */
  if (status === "ERROR") {
    return <FallbackDataWizard error={errorMessage} onRetry={resetWorkspace} />;
  }

  /* ── LOADING / SUCCESS: Split-screen view ── */
  return (
    <div className="split-screen-container">
      {/* ════ LEFT PANEL: Native PDF Viewer ════ */}
      <div className="left-panel">
        <PdfToolbar
          fileName={pdfUrl ? "resume.pdf" : ""}
          pdfUrl={pdfUrl}
        />
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="pdf-iframe"
            title="Candidate Resume PDF"
          />
        )}
      </div>

      {/* ════ RIGHT PANEL: AI Analytics Hub ════ */}
      <div className="right-panel">
        {status === "LOADING" && <SkeletonLoadingSpinner />}
        {status === "SUCCESS" && analyticData && (
          <AiAnalyticsWorkspace data={analyticData} onReset={resetWorkspace} />
        )}
      </div>
    </div>
  );
}
