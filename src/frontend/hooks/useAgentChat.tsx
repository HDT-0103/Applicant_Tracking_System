"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { streamClient } from "../services/httpClient";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useLang } from "../lib/i18n";

/**
 * Tin nhắn gốc của người dùng nếu lượt trả lời gần nhất của agent là câu hỏi
 * làm rõ; rỗng nếu không. Chỉ lấy MỘT tin (ngay trước câu hỏi) — sâu hơn là
 * gửi lại cả cuộc trò chuyện cho một planner chỉ đọc một dòng.
 */
export function clarificationHistory(
  messages: { role: string; content: string; clarification?: boolean }[],
): string[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") {
      if (!m.clarification) return [];
      const prevUser = messages.slice(0, i).reverse().find((x) => x.role === "user");
      return prevUser ? [prevUser.content] : [];
    }
    if (m.role === "error") return [];
  }
  return [];
}

export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  /** Agent hỏi lại để làm rõ; tin người dùng gửi tiếp sẽ mang theo tin trước đó. */
  clarification?: boolean;
  /** Gợi ý câu hỏi tiếp theo do agent đề xuất sau câu trả lời này. */
  suggestions?: string[];
  retryMessage?: string;
};

type Session = { conversationId: string; messages: AgentMessage[] };

/** Phiên "chung" (dashboard, tìm kiếm) khi không mở ứng viên nào. */
export const GLOBAL_SESSION = "global";
const MAX_SESSIONS = 20;

type AgentChatContextValue = {
  messages: AgentMessage[];
  isLoading: boolean;
  isOpen: boolean;
  conversationId: string;
  /** Ứng viên đang mở — mỗi ứng viên một phiên chat riêng. */
  activeCandidate: string | null;
  /** Gợi ý tiếp theo từ câu trả lời gần nhất của agent. */
  suggestions: string[];
  sendMessage: (message: string) => Promise<void>;
  retry: (message: string) => Promise<void>;
  resetSession: () => void;
  setIsOpen: (open: boolean) => void;
};

const STORAGE_KEY = "smartats_agent_chat_v2";
const AgentChatContext = createContext<AgentChatContextValue | null>(null);

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

type Stored = { sessions: Record<string, Session>; isOpen: boolean };

function readStored(): Stored {
  if (typeof window === "undefined") return { sessions: {}, isOpen: false };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored.sessions === "object") return { sessions: stored.sessions, isOpen: Boolean(stored.isOpen) };
  } catch {
    // Lịch sử hỏng không được chặn app mở.
  }
  return { sessions: {}, isOpen: false };
}

/** Giữ tối đa MAX_SESSIONS phiên; bỏ phiên cũ nhất (thứ tự chèn của object). */
function trimSessions(sessions: Record<string, Session>): Record<string, Session> {
  const keys = Object.keys(sessions);
  if (keys.length <= MAX_SESSIONS) return sessions;
  const keep = keys.slice(keys.length - MAX_SESSIONS);
  return Object.fromEntries(keep.map((k) => [k, sessions[k]]));
}

/**
 * Chỉ lấy uuid từ URL trang ứng viên. Đọc window thay vì useSearchParams: hook
 * này nằm trong Providers trên mọi trang, và useSearchParams ở đó bắt trang
 * tĩnh phải bọc Suspense.
 */
function candidateFromLocation(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/candidate-profile")) return null;
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("uuid");
}

export function AgentChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { candidateUuid: workspaceCandidate } = useWorkspace();
  const { lang } = useLang();
  const pathname = usePathname();
  const initial = useMemo(readStored, []);
  const [sessions, setSessions] = useState<Record<string, Session>>(initial.sessions);
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [isLoading, setIsLoading] = useState(false);

  // Ứng viên đang mở: theo URL trang ứng viên, dự phòng bằng workspace (trang
  // enriched đặt nó khi tải). Rời trang ứng viên là về phiên chung.
  const [activeCandidate, setActiveCandidate] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = candidateFromLocation(pathname);
    const onCandidatePage = Boolean(pathname && pathname.startsWith("/candidate-profile"));
    setActiveCandidate(fromUrl ?? (onCandidatePage ? workspaceCandidate : null));
  }, [pathname, workspaceCandidate]);

  const sessionKey = activeCandidate ?? GLOBAL_SESSION;
  const session = sessions[sessionKey] ?? { conversationId: makeId(), messages: [] };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, isOpen }));
  }, [sessions, isOpen]);

  const updateSession = useCallback((key: string, fn: (s: Session) => Session) => {
    setSessions((current) => {
      const prev = current[key] ?? { conversationId: makeId(), messages: [] };
      const next = { ...current, [key]: fn(prev) };
      return trimSessions(next);
    });
  }, []);

  const resetSession = useCallback(() => {
    setSessions((current) => {
      const next = { ...current };
      delete next[sessionKey];
      return next;
    });
  }, [sessionKey]);

  const sendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    const key = sessionKey;
    const current = sessions[key] ?? { conversationId: makeId(), messages: [] };
    const assistantId = makeId();
    updateSession(key, (s) => ({
      ...s,
      messages: [...s.messages, { id: makeId(), role: "user", content: trimmed }, { id: assistantId, role: "assistant", content: "" }],
    }));
    setIsLoading(true);

    // Chế độ ứng viên: gửi 8 lượt gần nhất để agent hiểu câu tiếp theo.
    // Chế độ tìm ứng viên: chỉ tin gốc khi đang trả lời câu hỏi làm rõ.
    const history = activeCandidate
      ? current.messages
          .filter((m) => m.role !== "error" && m.content)
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.role === "assistant" ? summaryOf(m.content) : m.content }))
      : clarificationHistory(current.messages);

    try {
      const response = await streamClient("/agents", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          conversation_id: current.conversationId,
          context: {
            current_page: window.location.pathname,
            user_id: user?.id ?? "unknown",
            candidate_uuid: activeCandidate,
            lang,
          },
          history,
        }),
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const patch = (fn: (m: AgentMessage) => AgentMessage) =>
        updateSession(key, (s) => ({ ...s, messages: s.messages.map((m) => (m.id === assistantId ? fn(m) : m)) }));
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6)) as {
            text?: string; message?: string; clarification?: boolean;
            result?: { summary?: string; candidates?: unknown[]; suggestions?: string[] };
          };
          if (event.includes("event: delta") && data.text) patch((m) => ({ ...m, content: m.content + data.text }));
          if (event.includes("event: error")) throw new Error(data.message ?? "Agent request failed");
          if (event.includes("event: done") && data.result) {
            const result = data.result;
            patch((m) => ({
              ...m,
              content: JSON.stringify(result),
              clarification: data.clarification === true,
              suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 3) : [],
            }));
          }
        }
      }
    } catch (error) {
      updateSession(key, (s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === assistantId
          ? { id: m.id, role: "error", content: error instanceof Error ? error.message : "Agent request failed", retryMessage: trimmed }
          : m)),
      }));
    } finally {
      setIsLoading(false);
    }
  }, [activeCandidate, isLoading, lang, sessionKey, sessions, updateSession, user?.id]);

  const suggestions = useMemo(() => {
    const last = [...session.messages].reverse().find((m) => m.role === "assistant" && m.content);
    return last?.suggestions ?? [];
  }, [session.messages]);

  const value = useMemo<AgentChatContextValue>(() => ({
    messages: session.messages,
    isLoading,
    isOpen,
    conversationId: session.conversationId,
    activeCandidate,
    suggestions,
    sendMessage,
    retry: sendMessage,
    resetSession,
    setIsOpen,
  }), [session.messages, session.conversationId, isLoading, isOpen, activeCandidate, suggestions, sendMessage, resetSession]);
  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>;
}

/** Nội dung agent đã trả (JSON kết quả) rút về câu tóm tắt để gửi lại làm lịch sử. */
export function summaryOf(content: string): string {
  try {
    const parsed = JSON.parse(content) as { summary?: string };
    return typeof parsed.summary === "string" ? parsed.summary : content;
  } catch {
    return content;
  }
}

export function useAgentChat(): AgentChatContextValue {
  const value = useContext(AgentChatContext);
  if (!value) throw new Error("useAgentChat must be used inside <AgentChatProvider>");
  return value;
}
