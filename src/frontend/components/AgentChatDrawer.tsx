"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ExternalLink, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAgentChat } from "../hooks/useAgentChat";
import { COMPANY_ONBOARDING_PATH, useAuth } from "../contexts/AuthContext";
import { isOperationalRole } from "../lib/rbac";
import { isPublicRoute } from "../lib/routes";
import { D, tint } from "../lib/shared";
import { useT } from "../lib/i18n";

/**
 * Nút chat có mặt trên MỌI màn hình đã đăng nhập với role nghiệp vụ
 * (hr / tech_lead). Ở dashboard / tin tuyển dụng nó tìm ứng viên và trả lời
 * câu hỏi chung; mở một hồ sơ thì chuyển sang hỏi đáp về đúng người đó.
 *
 * Vẫn ẩn ở đăng nhập / đăng ký / careers / onboarding: `user` được khôi phục
 * từ localStorage ngay khi app mở, nên chỉ hỏi "có user" là nút hiện cả trên
 * trang đăng nhập trong lúc AuthGuard đang chuyển hướng và trên trang careers
 * khi HR xem thử. Admin không có dữ liệu ứng viên để hỏi.
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
  const t = useT();
  return <div style={{ display: "grid", gap: 8 }}>
    <div style={{ lineHeight: 1.45 }}>{result.summary}</div>
    {result.candidates.map((candidate) => {
      const tone = candidate.recommendation === "Reject" ? D.red : candidate.recommendation === "Consider" ? D.amber : D.mint;
      const concerns = [...candidate.missing_requirements, ...candidate.risks];
      return <article key={candidate.candidate_id} style={{ border: `1px solid ${D.line}`, borderLeft: `3px solid ${tone}`, borderRadius: 6, padding: 10, background: D.surface }}>
        <div style={{ display: "flex", alignItems: "start", gap: 8 }}><strong style={{ flex: 1 }}>{candidate.display_name || t("candidate.chat.candidateFallback", { code: candidate.candidate_code })}</strong><span style={{ color: tone, fontWeight: 700, fontSize: 11 }}>{candidate.recommendation}</span></div>
        <div style={{ color: D.muted, fontSize: 11, marginTop: 4 }}>{t("candidate.chat.confidence", { pct: (candidate.confidence * 100).toFixed(0) })}</div>
        <div style={{ marginTop: 8, lineHeight: 1.45 }}>{candidate.reasoning}</div>
        {candidate.key_strengths.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>{candidate.key_strengths.map((item) => <span key={item} style={{ padding: "3px 6px", borderRadius: 3, background: D.mintSoft, color: D.sub, fontSize: 10 }}>{item}</span>)}</div>}
        {concerns.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 17, color: D.muted, fontSize: 11 }}>{concerns.map((item) => <li key={item}>{item}</li>)}</ul>}
        <button type="button" onClick={() => router.push(`/candidate-profile/enriched?uuid=${encodeURIComponent(candidate.candidate_id)}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, border: 0, padding: 0, background: "transparent", color: D.blue, cursor: "pointer", fontSize: 11 }}><ExternalLink size={12} /> {t("candidate.chat.viewProfile")}</button>
      </article>;
    })}
  </div>;
}

function MessageContent({ message }: { message: { role: "assistant" | "user" | "error"; content: string } }) {
  const result = message.role === "assistant" ? parseAgentResult(message.content) : null;
  if (!result) return <MarkdownMessage content={message.content} />;
  // Chế độ hỏi đáp ứng viên trả lời bằng văn bản (markdown), không có thẻ ứng viên.
  if (result.candidates.length === 0) return <MarkdownMessage content={result.summary} />;
  return <CandidateCards result={result} />;
}

/** Ô nút icon 28×28 canh giữa — mọi nút trong header dùng chung một cỡ. */
const iconButton: React.CSSProperties = {
  width: 28, height: 28, display: "grid", placeItems: "center",
  border: 0, borderRadius: 6, background: "transparent", cursor: "pointer", color: D.muted, padding: 0,
};

function Chips({ label, items, onPick, disabled }: { label: string; items: string[]; onPick: (s: string) => void; disabled: boolean }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: D.dim, display: "flex", alignItems: "center", gap: 5 }}>
        <Sparkles size={11} /> {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item)}
            style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${D.line}`, background: D.canvas, color: D.ink, fontSize: 11.5, cursor: disabled ? "default" : "pointer", textAlign: "left", fontFamily: D.font }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentChatDrawer() {
  const { user } = useAuth();
  const pathname = usePathname();
  const t = useT();
  const { messages, isLoading, isOpen, setIsOpen, sendMessage, retry, activeCandidate, suggestions, resetSession } = useAgentChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);
  if (!shouldShowAgentChat(user, pathname)) return null;

  // Câu hỏi mở đầu theo chế độ. Trang ứng viên: tóm tắt và đào sâu về đúng
  // người đó (tech lead không thấy PII nên thay câu dễ dính danh tính bằng
  // đánh giá qua GitHub). Dashboard: khái quát — tổng quan tin của mình, tìm
  // người, cách hệ thống chấm.
  const starters = activeCandidate
    ? (user?.role === "tech_lead"
        ? ["candidate.chat.starter.summary", "candidate.chat.starter.github", "candidate.chat.starter.gaps", "candidate.chat.starter.interview", "candidate.chat.starter.risks"]
        : ["candidate.chat.starter.summary", "candidate.chat.starter.strengths", "candidate.chat.starter.gaps", "candidate.chat.starter.interview", "candidate.chat.starter.risks"])
    : ["candidate.chat.starter.overview", "candidate.chat.starter.findBest", "candidate.chat.starter.findSkills", "candidate.chat.starter.howScoring"];
  const subtitle = activeCandidate
    ? t("candidate.chat.about", { code: activeCandidate.slice(0, 8) })
    : t("candidate.chat.general");
  const emptyText = activeCandidate ? t("candidate.chat.emptyCandidate") : t("candidate.chat.empty");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isLoading) return;
    setInput("");
    await sendMessage(message);
  }

  return (
    <>
      {!isOpen && <button type="button" aria-label={t("candidate.chat.open")} title={t("candidate.chat.open")} onClick={() => setIsOpen(true)} style={{ position: "fixed", right: 22, bottom: 22, zIndex: 60, width: 48, height: 48, display: "grid", placeItems: "center", padding: 0, border: 0, borderRadius: "50%", background: D.blue, color: "white", cursor: "pointer", boxShadow: "0 8px 24px rgba(15,23,42,.2)" }}><Bot size={22} strokeWidth={1.9} /></button>}
      {isOpen && <aside aria-label={t("candidate.chat.aria")} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: "min(390px, calc(100vw - 32px))", height: "min(650px, calc(100dvh - 40px))", display: "flex", flexDirection: "column", background: D.surface, border: `1px solid ${D.line}`, borderRadius: 8, boxShadow: "0 18px 45px rgba(15,23,42,.18)" }}>
        <header style={{ padding: "10px 10px 10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${D.line}` }}>
          <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: D.blueSoft, display: "grid", placeItems: "center", flexShrink: 0 }}><Bot size={16} color={D.blue} strokeWidth={1.9} /></div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            <strong style={{ fontSize: 13, lineHeight: 1.2 }}>{t("candidate.chat.title")}</strong>
            <span style={{ fontSize: 10.5, color: D.muted, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
          </div>
          <button type="button" aria-label={t("candidate.chat.newConversation")} title={t("candidate.chat.newConversation")} onClick={resetSession} disabled={isLoading || messages.length === 0} style={{ ...iconButton, opacity: messages.length === 0 ? .4 : 1 }}><RotateCcw size={15} /></button>
          <button type="button" aria-label={t("candidate.chat.minimizeAria")} title={t("candidate.chat.minimize")} onClick={() => setIsOpen(false)} style={iconButton}><ChevronDown size={16} /></button>
          <button type="button" aria-label={t("candidate.chat.closeAria")} title={t("common.close")} onClick={() => setIsOpen(false)} style={iconButton}><X size={15} /></button>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto 0", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ color: D.muted, fontSize: 12, textAlign: "center", padding: "0 12px" }}>{emptyText}</div>
              <Chips label={activeCandidate ? t("candidate.chat.starters") : t("candidate.chat.startersGeneral")} items={starters.map((k) => t(k))} onPick={(q) => void sendMessage(q)} disabled={isLoading} />
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} style={{ display: "flex", gap: 8, alignSelf: message.role === "user" ? "flex-end" : "stretch", maxWidth: message.role === "user" ? "88%" : "100%" }}>
              {message.role !== "user" && (
                <div aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: message.role === "error" ? tint("red", "18") : D.blueSoft, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
                  <Bot size={13} color={message.role === "error" ? D.red : D.blue} strokeWidth={1.9} />
                </div>
              )}
              <div style={{ minWidth: 0, maxWidth: message.role === "user" ? "100%" : "calc(100% - 32px)", padding: "9px 11px", borderRadius: 8, background: message.role === "user" ? D.blue : message.role === "error" ? tint("red", "12") : D.canvas, color: message.role === "user" ? "white" : message.role === "error" ? D.red : D.ink, fontSize: 12 }}>
                {message.role === "error"
                  ? <><div>{message.content}</div><button type="button" onClick={() => message.retryMessage && retry(message.retryMessage)} disabled={isLoading} style={{ marginTop: 8, border: "1px solid currentColor", background: "transparent", borderRadius: 4, padding: "4px 8px", color: "inherit", cursor: "pointer" }}>{t("common.retry")}</button></>
                  : <MessageContent message={message} />}
              </div>
            </div>
          ))}
          {!isLoading && messages.length > 0 && suggestions.length > 0 && (
            <div style={{ paddingLeft: 32 }}>
              <Chips label={t("candidate.chat.followUps")} items={suggestions} onPick={(q) => void sendMessage(q)} disabled={isLoading} />
            </div>
          )}
          {isLoading && <div style={{ alignSelf: "flex-start", color: D.muted, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> {t("candidate.chat.thinking")}</div>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${D.line}` }}><input value={input} onChange={(event) => setInput(event.target.value)} disabled={isLoading} placeholder={t("candidate.chat.placeholder")} style={{ minWidth: 0, flex: 1, border: `1px solid ${D.line}`, borderRadius: 5, padding: "9px 10px", font: `12px ${D.font}`, outline: "none" }} /><button type="submit" aria-label={t("candidate.chat.sendAria")} title={t("candidate.chat.send")} disabled={isLoading || !input.trim()} style={{ width: 36, border: 0, borderRadius: 5, background: D.blue, color: "white", cursor: "pointer", opacity: isLoading || !input.trim() ? .5 : 1 }}><Send size={15} /></button></form>
      </aside>}
    </>
  );
}