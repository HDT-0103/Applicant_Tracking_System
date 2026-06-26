"use client";

import React from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { IdleUploadZone } from "./components/IdleUploadZone";
import { PdfToolbar } from "./components/PdfToolbar";
import { AiAnalyticsWorkspace } from "./components/AiAnalyticsWorkspace";
import { SkeletonLoadingSpinner } from "./components/SkeletonLoadingSpinner";
import { FallbackDataWizard } from "./components/FallbackDataWizard";
import { AppHeader } from "./components/AppHeader";
import RunSyncButton from "./components/RunSyncButton";


const shell = (content: React.ReactNode) => (
  <div className="app-shell">
    <AppHeader />

    <div className="flex justify-end p-4">
      <RunSyncButton />
    </div>

    {content}
  </div>
);

export default function App() {
  const {
    status,
    pdfUrl,
    analyticData,
    errorMessage,
    uploadResume,
    resetWorkspace,
  } = useWorkspace();
  const { canUpload } = useAuth();

  const shell = (content: React.ReactNode) => (
    <div className="app-shell">
      <AppHeader />
      {content}
    </div>
  );

  /* ── IDLE: Show drop zone ── */
  if (status === "IDLE") {
    if (!canUpload) {
      return shell(
        <div className="access-denied-panel">
          <h2>Upload restricted</h2>
          <p>
            Your account has the Interviewer role. Resume ingestion is limited
            to Recruiters and Admins. Contact your HR administrator if you need
            upload access.
          </p>
        </div>,
      );
    }

    return shell(<IdleUploadZone onFileDrop={uploadResume} />);
  }

  /* ── ERROR: Show error wizard ── */
  if (status === "ERROR") {
    return shell(
      <FallbackDataWizard error={errorMessage} onRetry={resetWorkspace} />,
    );
  }

  /* ── LOADING / SUCCESS: Split-screen view ── */
  return shell(
    <div className="split-screen-container">
      {/* ════ LEFT PANEL: Native PDF Viewer ════ */}
      <div className="left-panel">
        <PdfToolbar
          fileName={pdfUrl ? "resume.pdf" : ""}
          pdfUrl={pdfUrl}
        />
        {pdfUrl && (
          <iframe
            // #toolbar=0  → ẩn thanh toolbar của Chrome PDF Viewer
            // #navpanes=0 → ẩn panel điều hướng bên trái (nếu có)
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
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
    </div>,
  );
}
