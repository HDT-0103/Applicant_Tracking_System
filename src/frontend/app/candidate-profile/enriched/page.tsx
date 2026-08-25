"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Shield, Loader2 } from "lucide-react";
import { D, Divider } from "@/lib/shared";
import { AppHeader } from "@/components/AppHeader";
import { LeftSidebar } from "@/components/LeftSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ApiError, api, getStoredAccessToken } from "@/services/httpClient";
import { getReviewStatus, type ReviewStatus } from "@/services/reviewService";
import { EnrichmentPanel } from "./_components/EnrichmentPanel";
import { EnrichedAnalytics } from "./_components/EnrichedAnalytics";
import { WS_UNAUTHORIZED_CODE } from "./types";
import type {
  EnrichedProfile,
  EnrichmentStatusResponse,
  WSMessage,
} from "./types";

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function EnrichedCandidateProfilePage() {
  const searchParams = useSearchParams();
  const candidateUuid = searchParams.get("uuid");
  const { syncCandidateProfile, setCandidateUuid } = useWorkspace();
  const { user, hasRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EnrichedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const resolvedRef = React.useRef(false);
  const hasTriggeredSyncRef = React.useRef(false);
  const isSyncingRef = React.useRef(false);

  // Set the candidateUuid in WorkspaceContext if we got a search param
  useEffect(() => {
    if (candidateUuid) {
      setCandidateUuid(candidateUuid);
    }
  }, [candidateUuid, setCandidateUuid]);

  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const manualCloseSocketsRef = React.useRef<WeakSet<WebSocket>>(new WeakSet());

  const markResolved = React.useCallback(() => {
    resolvedRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const resolveFromStatus = React.useCallback(
    async (uuid: string): Promise<boolean> => {
      try {
        const status = await api.get<EnrichmentStatusResponse>(
          `/api/enrichment/${uuid}`,
        );
        if (
          status.enrichment_status === "ENRICHED" &&
          status.enriched_profile
        ) {
          markResolved();
          setData(status.enriched_profile);
          setLoading(false);
          return true;
        }
        if (status.enrichment_status === "ENRICHMENT_FAILED") {
          markResolved();
          setError("Enrichment failed");
          setLoading(false);
          return true;
        }
        return false;
      } catch (err) {
        // 403 means authenticated but the role is not permitted — an admin
        // account, for instance, is confined to the Admin Panel and never
        // reaches the operational screens. Say so plainly: this error used to
        // land in the console only, leaving the page stuck on its loading
        // state so it read as a network fault.
        if (err instanceof ApiError && err.isForbidden) {
          markResolved();
          setError(
            "Your account does not have permission to view candidate profiles. " +
              "This screen is for HR and Tech Lead.",
          );
          setLoading(false);
          return true;
        }
        // 401 is already handled by httpClient: it refreshes silently, or
        // signs the user out when the session is truly dead.
        console.error("Failed to resolve enrichment status:", err);
        return false;
      }
    },
    [markResolved],
  );

  const connectWebSocket = React.useCallback(
    (uuid: string) => {
      if (resolvedRef.current) return;

      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const wsUrl =
        apiBase.replace(/^http/, "ws") +
        `/api/enrichment/ws/v1/analysis/${uuid}`;

      if (wsRef.current) {
        manualCloseSocketsRef.current.add(wsRef.current);
        wsRef.current.close(1000, "replace");
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Handshake xác thực: frame đầu tiên phải là access token, nếu không
        // backend đóng kết nối (4401). Gửi qua message chứ không qua query
        // string để token không lọt vào access log của server.
        ws.send(JSON.stringify({ token: getStoredAccessToken() }));
        console.log("WebSocket connected:", wsUrl);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          if (message.status === "ENRICHED" && message.data) {
            markResolved();
            setData(message.data);
            setLoading(false);
            manualCloseSocketsRef.current.add(ws);
            ws.close(1000, "resolved");
          } else if (message.status === "ENRICHMENT_FAILED") {
            markResolved();
            setError(message.error || "Enrichment failed");
            setLoading(false);
            manualCloseSocketsRef.current.add(ws);
            ws.close(1000, "resolved");
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        // Ignore transient socket errors from stale/closing connections during reconnect.
        if (resolvedRef.current) return;
        if (ws !== wsRef.current) return;
        if (manualCloseSocketsRef.current.has(ws)) return;
        console.warn("WebSocket transient error for:", wsUrl);
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected, code:", event.code);
        if (manualCloseSocketsRef.current.has(ws)) return;
        if (resolvedRef.current) return;

        // 4401 = server từ chối handshake xác thực. Thử lại cũng vô ích vì
        // token sẽ vẫn hỏng — reconnect ở đây sẽ thành vòng lặp 2.5s vô hạn.
        if (event.code === WS_UNAUTHORIZED_CODE) {
          setError("Your session has expired. Please sign in again.");
          setLoading(false);
          return;
        }

        void (async () => {
          const resolvedByStatus = await resolveFromStatus(uuid);
          if (!resolvedByStatus) {
            if (resolvedRef.current) return;
            reconnectTimeoutRef.current = setTimeout(() => {
              if (resolvedRef.current) return;
              console.log("WebSocket reconnecting...");
              connectWebSocket(uuid);
            }, 2500);
          }
        })();
      };
    },
    [markResolved, resolveFromStatus],
  );

  // Trigger sync on load only if not already enriched
  useEffect(() => {
    if (!candidateUuid) return;
    if (hasTriggeredSyncRef.current || isSyncingRef.current) return;

    const initLoad = async () => {
      hasTriggeredSyncRef.current = true;
      isSyncingRef.current = true;
      try {
        setSyncing(true);
        const statusResp = await api.get<EnrichmentStatusResponse>(
          `/api/enrichment/${candidateUuid}`,
        );
        if (
          statusResp.enrichment_status === "ENRICHED" &&
          statusResp.enriched_profile
        ) {
          markResolved();
          setData(statusResp.enriched_profile);
          setLoading(false);
          setSyncing(false);
          return;
        }
        if (statusResp.enrichment_status === "ENRICHMENT_FAILED") {
          markResolved();
          setError("Enrichment failed");
          setLoading(false);
          setSyncing(false);
          return;
        }
        const syncResp = await syncCandidateProfile(candidateUuid);
        if (syncResp.status === "already_enriched") {
          await resolveFromStatus(candidateUuid);
        }
        setSyncing(false);
      } catch (err) {
        console.error("Failed to trigger sync:", err);
        setSyncing(false);
      } finally {
        isSyncingRef.current = false;
      }
    };

    initLoad();
  }, [candidateUuid, syncCandidateProfile, resolveFromStatus, markResolved]);

  useEffect(() => {
    if (!candidateUuid || resolvedRef.current) return;

    connectWebSocket(candidateUuid);

    const manualCloseSockets = manualCloseSocketsRef.current;

    return () => {
      if (wsRef.current) {
        manualCloseSockets.add(wsRef.current);
        wsRef.current.close(1000);
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [candidateUuid, connectWebSocket]);

  const fetchReviewStatus = React.useCallback(async () => {
    if (!candidateUuid) return;
    try {
      const s = await getReviewStatus(candidateUuid);
      setReviewStatus(s);
    } catch {
      /* ignore, review module may not be available */
    }
  }, [candidateUuid]);

  useEffect(() => {
    if (data) fetchReviewStatus();
  }, [data, fetchReviewStatus, user?.role]);

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <AppHeader candidateName={null} />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Loader2
            size={24}
            strokeWidth={2}
            color={D.blue}
            style={{ animation: "spin 1s linear infinite" }}
          />
          <span style={{ fontSize: 14, color: D.sub }}>
            Enriching candidate profile...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <AppHeader candidateName={null} />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={24} strokeWidth={2} color={D.red} />
          <span style={{ fontSize: 14, color: D.sub }}>{error}</span>
        </div>
      </div>
    );
  }

  // HR và Tech Lead dùng CHUNG một layout. Trước đây tech_lead có nhánh render
  // riêng (không có LeftSidebar) — đó là ẩn ở tầng UI, dữ liệu PII vẫn nằm
  // trong response. Nay việc che là của ABAC ở backend: cùng một cây component,
  // dữ liệu tech_lead nhận về đã là "***".
  const isTechLead = hasRole("tech_lead");
  const candidateLabel =
    data?.full_name && data.full_name !== "***"
      ? data.full_name
      : isTechLead
        ? `Candidate ${candidateUuid?.slice(0, 8) || ""}`
        : null;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <AppHeader candidateName={candidateLabel} />
      {isTechLead && (
        <div
          style={{
            height: 30,
            background: `${D.amber}08`,
            borderBottom: `1px solid ${D.amber}20`,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Shield size={11} color={D.amber} />
          <span style={{ fontSize: 10, color: D.amber, fontWeight: 600 }}>
            Technical Review — PII restricted per ABAC policy
          </span>
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          animation: "fadeSlideIn 0.4s ease both",
        }}
      >
        {/* Left — navigation sidebar */}
        <LeftSidebar />
        {/* Divider */}
        <div style={{ width: 1, background: D.line, flexShrink: 0 }} />
        {/* Middle — enrichment dashboard */}
        <div style={{ flex: "0 0 44%", minWidth: 0, overflow: "hidden" }}>
          <EnrichmentPanel data={data} />
        </div>
        {/* Divider */}
        <div style={{ width: 1, background: D.line, flexShrink: 0 }} />
        {/* Right — enriched analytics */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <EnrichedAnalytics
            data={data}
            userRole={user?.role ?? "tech_lead"}
            candidateUuid={candidateUuid || ""}
            reviewStatus={reviewStatus}
            onRefreshReview={fetchReviewStatus}
          />
        </div>
      </div>
    </div>
  );
}
