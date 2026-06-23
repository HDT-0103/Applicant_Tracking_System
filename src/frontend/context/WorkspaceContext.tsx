"use client";

import React, { createContext, useContext, useState } from "react";
import { mockAnalyticsService } from "../src/services/mockAnalyticsService";

/* ------------------------------------------------------------------ */
/*  Domain Types                                                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Context Shape                                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<IngestionStatus>("IDLE");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [analyticData, setAnalyticData] = useState<CandidateAnalytics | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ------ Upload handler ------ */
  const uploadResume = async (file: File) => {
    setStatus("LOADING");
    setErrorMessage(null);
    // Create a local object URL so the PDF viewer can render immediately
    setPdfUrl(URL.createObjectURL(file));

    try {
      // ===== MOCK MODE (Phase 1) =====
      // TODO: replace with real fetch + initWebSocketPipeline() when backend is ready
      const result = await mockAnalyticsService(file);
      setAnalyticData(result);
      setStatus("SUCCESS");
      // ===== END MOCK MODE =====
    } catch (error: unknown) {
      setStatus("ERROR");
      const message =
        error instanceof Error ? error.message : "Unknown ingestion error.";
      setErrorMessage(message);
    }
  };

  /* ------ WebSocket pipeline (used in REAL MODE) ------ */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _initWebSocketPipeline = (uuid: string) => {
    const ws = new WebSocket(`wss://ats.internal:8421/stream/${uuid}`);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        type: string;
        data: CandidateAnalytics;
      };
      if (payload.type === "AI_ANALYTICS_COMPLETE") {
        setAnalyticData(payload.data);
        setStatus("SUCCESS");
        ws.close();
      }
    };

    ws.onerror = () => {
      setStatus("ERROR");
      setErrorMessage("WebSocket: Asynchronous engine failure or timeout.");
      ws.close();
    };
  };

  /* ------ Reset ------ */
  const resetWorkspace = () => {
    setStatus("IDLE");
    setPdfUrl(null);
    setAnalyticData(null);
    setErrorMessage(null);
  };

  return (
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

/* ------------------------------------------------------------------ */
/*  Hook                                                                */
/* ------------------------------------------------------------------ */

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return context;
};
