"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ExternalLink, Loader2, Send, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAgentChat } from "../hooks/useAgentChat";
import { COMPANY_ONBOARDING_PATH, useAuth } from "../contexts/AuthContext";
import { isOperationalRole } from "../lib/rbac";
import { isPublicRoute } from "../lib/routes";
import { D } from "../lib/shared";

/**
 * Nút chat chỉ có mặt trong workspace: đã đăng nhập, role nghiệp vụ (hr /
 * tech_lead), và không phải màn hình đăng nhập / đăng ký / careers /
 * onboarding. Trước đây nó chỉ hỏi `user` có tồn tại không, mà `user` được
 * khôi phục từ localStorage ngay khi app mở — nên nút hiện cả trên trang
 * đăng nhập trong lúc AuthGuard còn đang chuyển hướng, và trên trang careers
 * khi HR xem thử.
 */
export function shouldShowAgentChat(
  user: { role: string } | null | undefined,
  pathname: string | null | undefined,
): boolean {
  if (!user || !isOperationalRole(user.role as never)) return false;
  if (!pathname || isPublicRoute(pathname) || pathname === COMPANY_ONBOARDING_PATH) return false;
  return true;
}

function MarkdownMessage({ content }: { content: string }) {
  const renderInline = (text: string) => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} style={{ padding: "1px 4px", background: D.surface, borderRadius: 3 }}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });

  const renderText = (text: string) => {
    const blocks: React.ReactNode[] = [];
    let listItems: string[] = [];
    const flushList = () => {
      if (!listItems.length) return;
      blocks.push(<ul key={`list-${blocks.length}`} style={{ margin: "6px 0", paddingLeft: 18 }}>{listItems.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>);
      listItems = [];
    };
    text.split("\n").forEach((line, index) => {
      if (/^\s*[-*]\s+/.test(line)) {
        listItems.push(line.replace(/^\s*[-*]\s+/, ""));
        return;
      }
      flushList();
      if (!line.trim()) return;
      if (line.startsWith("#")) {
        blocks.push(<strong key={`heading-${index}`} style={{ display: "block", marginTop: 6 }}>{renderInline(line.replace(/^#+\s*/, ""))}</strong>);
        return;
      }
      blocks.push(<span key={`line-${index}`} style={{ display: "block" }}>{renderInline(line)}</span>);
    });
    flushList();
    return blocks;
  };

  return (
    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
      {content.split(/(```[\s\S]*?```)/g).map((part, index) => part.startsWith("```") ? (
        <pre key={index} style={{ margin: "8px 0", padding: 10, overflowX: "auto", background: D.canvas, borderRadius: 5, fontSize: 11 }}><code>{part.replace(/^```\w*\n?/, "").replace(/```$/, "")}</code></pre>
      ) : <span key={index}>{renderText(part)}</span>)}
    </div>
  );
}

type CandidateResult = {
  candidate_id: string;
  candidate_code: string;
  display_name: string;
  recommendation: "Strong Hire" | "Hire" | "Consider" | "Reject";
  confidence: number;
  reasoning: string;
  key_strengths: string[];
  missing_requirements: string[];
  risks: string[];
};

type AgentResult = { summary: string; candidates: CandidateResult[] };

function parseAgentResult(content: string): AgentResult | null {
  try {
    const result = JSON.parse(content) as AgentResult;
    return typeof result.summary === "string" && Array.isArray(result.candidates) ? result : null;
  } catch {
    return null;
  }
}

function CandidateCards({ result }: { result: AgentResult }) {
  const router = useRouter();
  return <div style={{ display: "grid", gap: 8 }}>
    <div style={{ lineHeight: 1.45 }}>{result.summary}</div>
    {result.candidates.map((candidate) => {
      const tone = candidate.recommendation === "Reject" ? D.red : candidate.recommendation === "Consider" ? D.amber : D.mint;
      const concerns = [...candidate.missing_requirements, ...candidate.risks];
      return <article key={candidate.candidate_id} style={{ border: `1px solid ${D.line}`, borderLeft: `3px solid ${tone}`, borderRadius: 6, padding: 10, background: D.surface }}>
        <div style={{ display: "flex", alignItems: "start", gap: 8 }}><strong style={{ flex: 1 }}>{candidate.display_name || `Ứng viên (#${candidate.candidate_code})`}</strong><span style={{ color: tone, fontWeight: 700, fontSize: 11 }}>{candidate.recommendation}</span></div>
        <div style={{ color: D.muted, fontSize: 11, marginTop: 4 }}>Confidence: {(candidate.confidence * 100).toFixed(0)}%</div>
        <div style={{ marginTop: 8, lineHeight: 1.45 }}>{candidate.reasoning}</div>
        {candidate.key_strengths.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>{candidate.key_strengths.map((item) => <span key={item} style={{ padding: "3px 6px", borderRadius: 3, background: D.mintSoft, color: D.sub, fontSize: 10 }}>{item}</span>)}</div>}
        {concerns.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 17, color: D.muted, fontSize: 11 }}>{concerns.map((item) => <li key={item}>{item}</li>)}</ul>}
        <button type="button" onClick={() => router.push(`/candidate-profile/enriched?uuid=${encodeURIComponent(candidate.candidate_id)}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, border: 0, padding: 0, background: "transparent", color: D.blue, cursor: "pointer", fontSize: 11 }}><ExternalLink size={12} /> View profile</button>
      </article>;
    })}
  </div>;
}

function MessageContent({ message }: { message: { role: "assistant" | "user" | "error"; content: string } }) {
  const result = message.role === "assistant" ? parseAgentResult(message.content) : null;
  return result ? <CandidateCards result={result} /> : <MarkdownMessage content={message.content} />;
}

export function AgentChatDrawer() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { messages, isLoading, isOpen, setIsOpen, sendMessage, retry } = useAgentChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  if (!shouldShowAgentChat(user, pathname)) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isLoading) return;
    setInput("");
    await sendMessage(message);
  }

  return (
    <>
      {!isOpen && <button type="button" aria-label="Open agent chat" title="Open agent chat" onClick={() => setIsOpen(true)} style={{ position: "fixed", right: 22, bottom: 22, zIndex: 60, width: 46, height: 46, border: 0, borderRadius: "50%", background: D.blue, color: "white", cursor: "pointer", boxShadow: "0 8px 24px rgba(15,23,42,.2)" }}><Bot size={19} /></button>}
      {isOpen && <aside aria-label="Agent chat" style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: "min(390px, calc(100vw - 32px))", height: "min(650px, calc(100dvh - 40px))", display: "flex", flexDirection: "column", background: D.surface, border: `1px solid ${D.line}`, borderRadius: 8, boxShadow: "0 18px 45px rgba(15,23,42,.18)" }}>
        <header style={{ padding: "14px 15px", display: "flex", alignItems: "center", gap: 9, borderBottom: `1px solid ${D.line}` }}><Bot size={17} color={D.blue} /><strong style={{ flex: 1, fontSize: 13 }}>ATS Agent</strong><button type="button" aria-label="Minimize agent chat" title="Minimize" onClick={() => setIsOpen(false)} style={{ border: 0, background: "none", cursor: "pointer", color: D.muted }}><ChevronDown size={16} /></button><button type="button" aria-label="Close agent chat" title="Close" onClick={() => setIsOpen(false)} style={{ border: 0, background: "none", cursor: "pointer", color: D.muted }}><X size={15} /></button></header>
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && <div style={{ color: D.muted, fontSize: 12, textAlign: "center", margin: "auto 12px" }}>Ask the agent to search candidates or explain a recommendation.</div>}
          {messages.map((message) => <div key={message.id} style={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 11px", borderRadius: 7, background: message.role === "user" ? D.blue : message.role === "error" ? "#fff1f2" : D.canvas, color: message.role === "user" ? "white" : message.role === "error" ? "#be123c" : D.ink, fontSize: 12 }}>{message.role === "error" ? <><div>{message.content}</div><button type="button" onClick={() => message.retryMessage && retry(message.retryMessage)} disabled={isLoading} style={{ marginTop: 8, border: "1px solid currentColor", background: "transparent", borderRadius: 4, padding: "4px 8px", color: "inherit", cursor: "pointer" }}>Retry</button></> : <MessageContent message={message} />}</div>)}
          {isLoading && <div style={{ alignSelf: "flex-start", color: D.muted, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> Agent is thinking...</div>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${D.line}` }}><input value={input} onChange={(event) => setInput(event.target.value)} disabled={isLoading} placeholder="Ask the agent..." style={{ minWidth: 0, flex: 1, border: `1px solid ${D.line}`, borderRadius: 5, padding: "9px 10px", font: `12px ${D.font}`, outline: "none" }} /><button type="submit" aria-label="Send message" title="Send" disabled={isLoading || !input.trim()} style={{ width: 36, border: 0, borderRadius: 5, background: D.blue, color: "white", cursor: "pointer", opacity: isLoading || !input.trim() ? .5 : 1 }}><Send size={15} /></button></form>
      </aside>}
    </>
  );
}