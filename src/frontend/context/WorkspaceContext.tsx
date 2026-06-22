import React, { createContext, useContext, useState } from "react";
import { mockAnalyticsService } from "../src/services/mockAnalyticsService"; // Sẽ tạo ở Step 2

export interface CandidateAnalytics {
  uuid: string;
  fullName: string;
  title: string;
  location: string;
  affinityScore: number;
  matchConfidence: string;
  matchPercentile: number;
  breakdown: {
    experience: number;
    skillsFit: number;
    culture: number;
  };
  skills: { name: string; score: number }[];
  trajectory: {
    year: number;
    role: string;
    company: string;
    period: string;
    highlight: string;
    isCurrent: boolean;
    type: "work" | "edu";
  }[];
  appliedRole: string;
  appliedDate: string;
  source: string;
  seniority: string;
  assessmentStatus: string;
  department: string;
}

export type IngestionStatus = "IDLE" | "LOADING" | "SUCCESS" | "ERROR";

interface WorkspaceContextProps {
  status: IngestionStatus;
  pdfUrl: string | null;
  analyticData: CandidateAnalytics | null;
  errorMessage: string | null;
  uploadResume: (file: File) => Promise<void>;
  resetWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined>(
  undefined,
);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<IngestionStatus>("IDLE");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [analyticData, setAnalyticData] = useState<CandidateAnalytics | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadResume = async (file: File) => {
    setStatus("LOADING");
    setErrorMessage(null);
    setPdfUrl(URL.createObjectURL(file)); // Tạo local URL để hiển thị bản xem trước PDF ngay lập tức

    try {
      // ===== MOCK MODE =====
      const mockResult = await mockAnalyticsService(file);
      setAnalyticData(mockResult);
      setStatus("SUCCESS");
      // ===== END MOCK MODE =====

      /* === REAL MODE  ===
      const formData = new FormData();
      formData.append('resume', file);
      const response = await fetch('/api/v1/ingest', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }
      const result = await response.json();
      initWebSocketPipeline(result.candidateUuid);
      */
    } catch (error: any) {
      setStatus("ERROR");
      setErrorMessage(error.message || "An unknown validation error occurred.");
    }
  };

  // WebSocket Core Pipeline (Đã sửa dùng backtick ` đúng chuẩn ES6)
  const initWebSocketPipeline = (uuid: string) => {
    const ws = new WebSocket(`wss://ats.internal:8421/stream/${uuid}`);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "AI_ANALYTICS_COMPLETE") {
        setAnalyticData(payload.data);
        setStatus("SUCCESS");
        ws.close();
      }
    };

    ws.onerror = () => {
      setStatus("ERROR");
      setErrorMessage("Asynchronous Engine Failure: WebSocket disconnected.");
      ws.close();
    };
  };

  const resetWorkspace = () => {
    setStatus("IDLE");
    setPdfUrl(null);
    setAnalyticData(null);
    setErrorMessage(null);
  };

  return (
    // Đã sửa lỗi cú pháp: Thêm dấu "=" sau value
    <WorkspaceContext.Provider
      value={{
        status,
        pdfUrl,
        analyticData,
        errorMessage,
        uploadResume,
        resetWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return context;
};
