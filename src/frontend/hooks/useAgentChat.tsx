"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { streamClient } from "../services/httpClient";
import { useAuth } from "../contexts/AuthContext";

export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  retryMessage?: string;
};

type AgentChatContextValue = {
  messages: AgentMessage[];
  isLoading: boolean;
  isOpen: boolean;
  conversationId: string;
  sendMessage: (message: string) => Promise<void>;
  retry: (message: string) => Promise<void>;
  setIsOpen: (open: boolean) => void;
};

const STORAGE_KEY = "smartats_agent_chat";
const AgentChatContext = createContext<AgentChatContextValue | null>(null);

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function readStoredState(): Pick<AgentChatContextValue, "messages" | "conversationId" | "isOpen"> {
  if (typeof window === "undefined") return { messages: [], conversationId: makeId(), isOpen: false };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored?.conversationId && Array.isArray(stored.messages)) return stored;
  } catch {
    // Corrupt local history should not prevent the application from opening.
  }
  return { messages: [], conversationId: makeId(), isOpen: false };
}

export function AgentChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const initial = useMemo(readStoredState, []);
  const [messages, setMessages] = useState<AgentMessage[]>(initial.messages);
  const [conversationId] = useState(initial.conversationId);
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, conversationId, isOpen }));
  }, [messages, conversationId, isOpen]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    const assistantId = makeId();
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsLoading(true);
    try {
      const response = await streamClient("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          conversation_id: conversationId,
          context: { current_page: window.location.pathname, user_id: user?.id ?? "unknown" },
          history: messages.slice(-6).map((item) => `${item.role}: ${item.content}`),
        }),
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6)) as { content?: string; text?: string; message?: string; result?: unknown };
          if (event.includes("event: direct") && data.content) {
            setMessages((current) => current.map((item) => item.id === assistantId
              ? { ...item, content: data.content! }
              : item));
          }
          if (event.includes("event: delta") && data.text) {
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + data.text } : item));
          }
          if (event.includes("event: error")) throw new Error(data.message ?? "Agent request failed");
          if (event.includes("event: done") && data.result) {
            setMessages((current) => current.map((item) => item.id === assistantId
              ? { ...item, content: JSON.stringify(data.result) }
              : item));
          }
        }
      }
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === assistantId ? { id: item.id, role: "error", content: error instanceof Error ? error.message : "Agent request failed", retryMessage: trimmed } : item));
    } finally {
      setIsLoading(false);
    }
  }

  const value = useMemo(() => ({ messages, isLoading, isOpen, conversationId, sendMessage, retry: sendMessage, setIsOpen }), [messages, isLoading, isOpen, conversationId]);
  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>;
}

export function useAgentChat(): AgentChatContextValue {
  const value = useContext(AgentChatContext);
  if (!value) throw new Error("useAgentChat must be used inside <AgentChatProvider>");
  return value;
}