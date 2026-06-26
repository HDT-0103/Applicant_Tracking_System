"use client";

import React, { useState } from "react";

interface PdfToolbarProps {
  fileName: string;
  pdfUrl: string | null;
}

export const PdfToolbar: React.FC<PdfToolbarProps> = ({ fileName, pdfUrl }) => {
  const [page, setPage] = useState(1);
  // Note: real page count comes from the PDF; mock it as 3 for now
  const totalPages = 3;

  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(totalPages, p + 1));

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="pdf-toolbar">
      <span className="file-name" title={fileName}>
        {fileName || "document.pdf"}
      </span>

      <div className="page-controls">
        <button
          className="page-btn"
          type="button"
          onClick={prev}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span>
          {page} of {totalPages}
        </span>
        <button
          className="page-btn"
          type="button"
          onClick={next}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      <span style={{ color: "#9ca3af", fontSize: 13 }}>100%</span>

      <span className="spacer" />

      <button
        className="download-btn"
        type="button"
        onClick={handleDownload}
        disabled={!pdfUrl}
      >
        ↓ Download Document
      </button>
    </div>
  );
};
