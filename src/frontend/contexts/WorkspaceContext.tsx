"use client";

import React, { createContext, useContext, useState } from "react";
import { mockAnalyticsService } from "../services/mockAnalyticsService";
import { api } from "../services/httpClient";

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

  const useMockIngestion =
    process.env.NEXT_PUBLIC_USE_MOCK_INGESTION !== "false";

  /* ------ Upload handler ------ */
  const uploadResume = async (file: File) => {
    setStatus("LOADING");
    setErrorMessage(null);
    setPdfUrl(URL.createObjectURL(file));

    try {
      if (useMockIngestion) {
        const result = await mockAnalyticsService(file);
        setAnalyticData(result);
        setStatus("SUCCESS");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await api.post<{ uuid: string }>(
        "/api/ingestion/upload",
        formData,
      );

      _initWebSocketPipeline(uploadResponse.uuid);
    } catch (error: unknown) {
      setStatus("ERROR");
      const message =
        error instanceof Error ? error.message : "Unknown ingestion error.";
      setErrorMessage(message);
    }
  };

  /* ------ WebSocket pipeline (used in REAL MODE) ------ */
  const _initWebSocketPipeline = (uuid: string) => {
    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
    const ws = new WebSocket(`${wsBase}/stream/${uuid}`);

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
