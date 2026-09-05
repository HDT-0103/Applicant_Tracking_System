/**
 * @vitest-environment jsdom
 */
/**
 * Phiên chat theo màn hình: mở một hồ sơ là một phiên MỚI (câu hỏi mở đầu
 * hiện lại), phiên chung ở dashboard thì giữ qua lần tải trang, đăng xuất
 * xoá sạch. Và tin gửi lên backend mang đúng ngữ cảnh: chỉ khi trả lời câu
 * hỏi làm rõ mới có cờ `clarification_reply` kèm tin gốc.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

let pathname = "/";
let user: { id: string; role: string } | null = { id: "hr-1", role: "hr" };
let authLoading = false;
const streamClient = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user, isLoading: authLoading }) }));
vi.mock("../../contexts/WorkspaceContext", () => ({ useWorkspace: () => ({ candidateUuid: null }) }));
vi.mock("../../lib/i18n", () => ({ useLang: () => ({ lang: "vi" }) }));
vi.mock("../../services/httpClient", () => ({ streamClient: (...a: unknown[]) => streamClient(...a) }));

import { AgentChatProvider, awaitingClarification, persistedSessions, recentTurns, useAgentChat } from "../useAgentChat";

const STORAGE_KEY = "smartats_agent_chat_v2";
const CANDIDATE = "8b5c4334-0000-4000-8000-000000000000";

function setLocation(path: string, search = "") {
  pathname = path;
  window.history.replaceState({}, "", `${path}${search}`);
}

function doneResponse(result: object, extra: object = {}) {
  const body = `event: done\ndata: ${JSON.stringify({ conversation_id: "c", result, ...extra })}\n\n`;
  return new Response(body, { status: 200 });
}

const wrapper = ({ children }: { children: React.ReactNode }) => <AgentChatProvider>{children}</AgentChatProvider>;

beforeEach(() => {
  localStorage.clear();
  streamClient.mockReset();
  user = { id: "hr-1", role: "hr" };
  authLoading = false;
  setLocation("/");
});
afterEach(cleanup);

describe("phiên theo màn hình", () => {
  it("mở một hồ sơ là một phiên mới, kể cả khi hôm trước đã hỏi về người đó", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isOpen: false,
      sessions: {
        global: { conversationId: "g", messages: [{ id: "1", role: "user", content: "tìm backend" }] },
        [CANDIDATE]: { conversationId: "c", messages: [{ id: "2", role: "user", content: "điểm mạnh?" }] },
      },
    }));
    const { result, rerender } = renderHook(() => useAgentChat(), { wrapper });
    expect(result.current.messages.map((m) => m.content)).toEqual(["tìm backend"]);

    setLocation("/candidate-profile/enriched", `?uuid=${CANDIDATE}`);
    rerender();
    expect(result.current.activeCandidate).toBe(CANDIDATE);
    expect(result.current.messages).toEqual([]);
  });

  it("rời hồ sơ rồi quay lại: lại là phiên mới; phiên chung vẫn còn", async () => {
    streamClient.mockResolvedValue(doneResponse({ summary: "Mạnh về Python", candidates: [], suggestions: [] }, { mode: "candidate" }));
    setLocation("/candidate-profile/enriched", `?uuid=${CANDIDATE}`);
    const { result, rerender } = renderHook(() => useAgentChat(), { wrapper });
    await act(async () => { await result.current.sendMessage("điểm mạnh?"); });
    expect(result.current.messages).toHaveLength(2);

    setLocation("/");
    rerender();
    expect(result.current.activeCandidate).toBeNull();
    expect(result.current.messages).toEqual([]);

    setLocation("/candidate-profile/enriched", `?uuid=${CANDIDATE}`);
    rerender();
    expect(result.current.messages).toEqual([]);
  });

  it("chỉ phiên chung được ghi vào localStorage", () => {
    const sessions = {
      global: { conversationId: "g", messages: [] },
      [CANDIDATE]: { conversationId: "c", messages: [] },
    };
    expect(Object.keys(persistedSessions(sessions))).toEqual(["global"]);
  });

  it("đăng xuất xoá lịch sử chat", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isOpen: false,
      sessions: { global: { conversationId: "g", messages: [{ id: "1", role: "user", content: "tìm backend" }] } },
    }));
    const { result, rerender } = renderHook(() => useAgentChat(), { wrapper });
    expect(result.current.messages).toHaveLength(1);
    user = null;
    rerender();
    expect(result.current.messages).toEqual([]);
  });
});

describe("ngữ cảnh gửi lên backend", () => {
  function lastBody(): Record<string, unknown> {
    const [, init] = streamClient.mock.calls.at(-1) as [string, RequestInit];
    return JSON.parse(String(init.body));
  }

  it("ở dashboard: 8 lượt gần nhất làm ngữ cảnh, không có cờ làm rõ", async () => {
    streamClient.mockResolvedValue(doneResponse({ summary: "Chào bạn!", candidates: [], suggestions: ["Tìm ứng viên Python"] }, { mode: "chat" }));
    const { result } = renderHook(() => useAgentChat(), { wrapper });
    await act(async () => { await result.current.sendMessage("xin chào"); });
    expect(lastBody()).toMatchObject({ clarification_reply: false, history: [] });
    expect(result.current.suggestions).toEqual(["Tìm ứng viên Python"]);

    await act(async () => { await result.current.sendMessage("nói rõ hơn"); });
    expect(lastBody().history).toEqual([
      { role: "user", content: "xin chào" },
      { role: "assistant", content: "Chào bạn!" },
    ]);
    expect(lastBody().clarification_reply).toBe(false);
  });

  it("trả lời câu hỏi làm rõ: gửi tin gốc kèm cờ, để backend ghép thành một yêu cầu", async () => {
    streamClient.mockResolvedValueOnce(doneResponse({ summary: "Bạn tuyển vị trí nào?", candidates: [] }, { mode: "search", clarification: true }));
    const { result } = renderHook(() => useAgentChat(), { wrapper });
    await act(async () => { await result.current.sendMessage("tìm ứng viên"); });
    expect(awaitingClarification(result.current.messages)).toBe(true);

    streamClient.mockResolvedValueOnce(doneResponse({ summary: "ok", candidates: [] }, { mode: "search" }));
    await act(async () => { await result.current.sendMessage("Backend, Python"); });
    expect(lastBody()).toMatchObject({ clarification_reply: true, history: ["tìm ứng viên"] });
  });

  it("recentTurns bỏ lỗi và rút JSON kết quả về câu tóm tắt", () => {
    expect(recentTurns([
      { id: "1", role: "user", content: "a" },
      { id: "2", role: "error", content: "boom" },
      { id: "3", role: "assistant", content: JSON.stringify({ summary: "S", candidates: [] }) },
    ])).toEqual([{ role: "user", content: "a" }, { role: "assistant", content: "S" }]);
  });
});
