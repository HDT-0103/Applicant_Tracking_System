"use client";

import React, { createContext, useContext, useState } from "react";
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
  candidateUuid: string | null;
  errorMessage: string | null;
  uploadResume: (file: File) => Promise<void>;
  resetWorkspace: () => void;
  syncCandidateProfile: (uuid?: string) => Promise<{ redirect: string }>;
  setCandidateUuid: (uuid: string | null) => void;
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
  const [candidateUuid, setCandidateUuid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ------ Upload handler ------ */
  const uploadResume = async (file: File) => {
    setStatus("LOADING");
    setErrorMessage(null);
    setPdfUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await api.post<{ uuid: string; full_name: string | null; github_username: string | null; linkedin_url: string | null }>(
        "/api/ingestion/upload",
        formData,
      );

      setCandidateUuid(uploadResponse.uuid);
      setStatus("SUCCESS");
    } catch (error: unknown) {
      setStatus("ERROR");
      const message =
        error instanceof Error ? error.message : "Unknown ingestion error.";
      setErrorMessage(message);
    }
  };

  /* ------ Sync Enrichment ------ */
  const syncCandidateProfile = async (uuid?: string): Promise<{ redirect: string }> => {
    const targetUuid = uuid || candidateUuid;
    if (!targetUuid) {
      throw new Error("No candidate UUID available for sync.");
    }

    const response = await api.post<{ status: string; redirect: string; candidate_uuid: string }>(
      `/api/enrichment/${targetUuid}/sync`,
    );

    // Also update the context's candidateUuid if we passed one
    if (uuid && candidateUuid !== uuid) {
      setCandidateUuid(uuid);
    }

    return response;
  };

  /* ------ Reset ------ */
  const resetWorkspace = () => {
    setStatus("IDLE");
    setPdfUrl(null);
    setAnalyticData(null);
    setCandidateUuid(null);
    setErrorMessage(null);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        status,
        pdfUrl,
        analyticData,
        candidateUuid,
        errorMessage,
        uploadResume,
        resetWorkspace,
        syncCandidateProfile,
        setCandidateUuid,
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
