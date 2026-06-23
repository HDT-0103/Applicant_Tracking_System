"use client";

import React from "react";

interface FallbackDataWizardProps {
  error: string | null;
  onRetry: () => void;
}

export const FallbackDataWizard: React.FC<FallbackDataWizardProps> = ({
  error,
  onRetry,
}) => (
  <div className="error-wizard" role="alert">
    <div className="error-icon">⚠</div>
    <h2 className="error-title">Ingestion Failed</h2>
    <p className="error-message">
      {error ?? "An unknown error occurred during the ingestion pipeline."}
    </p>
    <button className="retry-btn" type="button" onClick={onRetry}>
      ↩ Reset & Try Again
    </button>
  </div>
);
