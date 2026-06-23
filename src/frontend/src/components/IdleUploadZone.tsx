"use client";

import React, { useState, useRef } from "react";

interface IdleUploadZoneProps {
  onFileDrop: (file: File) => Promise<void>;
}

export const IdleUploadZone: React.FC<IdleUploadZoneProps> = ({
  onFileDrop,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileValidation = (file: File) => {
    setLocalError(null);

    if (file.type !== "application/pdf") {
      setLocalError(
        "Invalid file format. Only PDF files are accepted.",
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setLocalError("File exceeds 10 MB size limit.");
      return;
    }

    onFileDrop(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileValidation(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileValidation(file);
  };

  return (
    <div className="idle-upload-page">
      {/* ── Left panel: drop zone ── */}
      <div className="left-panel-idle">
        <div
          className={`drop-zone${isDragging ? " dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          aria-label="Drop zone: click or drag a PDF file here"
        >
          {/* Upload cloud icon */}
          <svg
            className="upload-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="upload-text">
            Drag and drop engineering candidate PDF resume here to ingest
          </p>
          <small className="upload-hint">Max 10 MB · PDF only</small>

          <span className="divider-text">or</span>

          <button
            className="browse-btn"
            type="button"
            onClick={(e) => {
              // Stop propagation so the parent div onClick doesn't double-fire
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse Files
          </button>

          <span className="pdf-badge">.pdf</span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={handleInputChange}
          />
        </div>

        {localError && (
          <div className="local-validation-error" role="alert">
            {localError}
          </div>
        )}
      </div>

      {/* ── Right panel: blurred skeleton placeholder ── */}
      <div className="right-panel-placeholder">
        <div className="idle-skeleton-wrap">
          {/* Mimic the analytics workspace skeleton */}
          <div className="sk" style={{ height: 28, width: "60%" }} />
          <div className="sk" style={{ height: 14, width: "40%" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[80, 70, 90, 60].map((w, i) => (
              <div key={i} className="sk" style={{ height: 24, width: w }} />
            ))}
          </div>
          <div className="sk" style={{ height: 10, width: "30%", marginTop: 12 }} />
          <div className="sk" style={{ height: 48, width: "35%" }} />
          {["90%", "84%", "79%"].map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="sk" style={{ height: 12, width: 64 }} />
              <div className="sk" style={{ height: 6, flex: 1 }} />
            </div>
          ))}
          <div className="sk" style={{ height: 160, borderRadius: 8, marginTop: 8 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} className="sk" style={{ height: 40, borderRadius: 6 }} />
          ))}
        </div>
        <div className="mock-blur-overlay" style={{ position: "absolute" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span>Awaiting ingestion stream…</span>
        </div>
      </div>
    </div>
  );
};