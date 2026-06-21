if (status === "IDLE") {
  return <IdleUploadZone onFileDrop={uploadResume} />;
}

return (
  <div className="flex h-screen w-full split-screen-container">
    {/* PANEL TRÁI: HIỂN THỊ NATIVE PDF VIEW */}
    <div className="w-1/2 left-panel">
      <PdfToolbar />
      {pdfUrl && (
        <iframe src={pdfUrl} className="w-full h-full" title="Resume PDF" />
      )}
    </div>

    {/* HOÀNG & TOÀN SẼ CHÈN COMPONENT CODE VÀO ĐÂY */}
    {/* PANEL PHẢI: AI ANALYTICS HUB */}
    <div className="w-1/2 right-panel overflow-y-auto">
      {status === "LOADING" && <SkeletonLoadingSpinner />}
      {status === "SUCCESS" && <AiAnalyticsWorkspace data={analyticsData} />}
      {status === "ERROR" && (
        <FallbackDataWizard error={errorMessage} onRetry={resetWorkspace} />
      )}
    </div>
  </div>
);
