"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Loader2, Send, X } from "lucide-react";
import { useAgentChat } from "../hooks/useAgentChat";
import { useAuth } from "../contexts/AuthContext";
import { D } from "../lib/shared";

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

export function AgentChatDrawer() {
  const { user } = useAuth();
  const { messages, isLoading, isOpen, setIsOpen, sendMessage, retry } = useAgentChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  if (!user) return null;

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
          {messages.map((message) => <div key={message.id} style={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 11px", borderRadius: 7, background: message.role === "user" ? D.blue : message.role === "error" ? "#fff1f2" : D.canvas, color: message.role === "user" ? "white" : message.role === "error" ? "#be123c" : D.ink, fontSize: 12 }}>{message.role === "error" ? <><div>{message.content}</div><button type="button" onClick={() => message.retryMessage && retry(message.retryMessage)} disabled={isLoading} style={{ marginTop: 8, border: "1px solid currentColor", background: "transparent", borderRadius: 4, padding: "4px 8px", color: "inherit", cursor: "pointer" }}>Retry</button></> : <MarkdownMessage content={message.content} />}</div>)}
          {isLoading && <div style={{ alignSelf: "flex-start", color: D.muted, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> Agent is thinking...</div>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${D.line}` }}><input value={input} onChange={(event) => setInput(event.target.value)} disabled={isLoading} placeholder="Ask the agent..." style={{ minWidth: 0, flex: 1, border: `1px solid ${D.line}`, borderRadius: 5, padding: "9px 10px", font: `12px ${D.font}`, outline: "none" }} /><button type="submit" aria-label="Send message" title="Send" disabled={isLoading || !input.trim()} style={{ width: 36, border: 0, borderRadius: 5, background: D.blue, color: "white", cursor: "pointer", opacity: isLoading || !input.trim() ? .5 : 1 }}><Send size={15} /></button></form>
      </aside>}
    </>
  );
}