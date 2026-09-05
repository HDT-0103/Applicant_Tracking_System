/**
 * @vitest-environment jsdom
 */
/**
 * Nút chat với agent chỉ xuất hiện khi đã mở một ứng viên cụ thể.
 *
 * `user` được khôi phục từ localStorage ngay khi app mở, nên chỉ kiểm "có
 * user" là nút hiện cả trên trang đăng nhập (trong lúc AuthGuard đang chuyển
 * hướng) và trên trang careers khi HR xem thử. Chủ dự án muốn nó chỉ có mặt
 * khi người dùng đã vào dashboard.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let pathname = "/";
let user: { role: string } | null = { role: "hr" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user }),
  COMPANY_ONBOARDING_PATH: "/onboarding/company",
}));
let chatState = {
  messages: [] as { id: string; role: string; content: string; suggestions?: string[] }[],
  isLoading: false,
  isOpen: false,
  activeCandidate: null as string | null,
  suggestions: [] as string[],
};
const sendMessage = vi.fn();
const resetSession = vi.fn();
vi.mock("../../hooks/useAgentChat", () => ({
  useAgentChat: () => ({
    ...chatState,
    setIsOpen: vi.fn(),
    sendMessage,
    retry: vi.fn(),
    resetSession,
  }),
}));

import { AgentChatDrawer, shouldShowAgentChat } from "../AgentChatDrawer";

afterEach(() => {
  cleanup();
  sendMessage.mockReset();
  resetSession.mockReset();
  chatState = { messages: [], isLoading: false, isOpen: false, activeCandidate: null, suggestions: [] };
});

describe("shouldShowAgentChat", () => {
  it("hiện khi đã mở một ứng viên cụ thể, cho cả hr lẫn tech_lead", () => {
    expect(shouldShowAgentChat({ role: "hr" }, "/candidate-profile/enriched")).toBe(true);
    expect(shouldShowAgentChat({ role: "tech_lead" }, "/candidate-profile")).toBe(true);
  });

  it("ẩn trên dashboard, tìm kiếm và tin tuyển dụng — chưa có ứng viên nào để hỏi", () => {
    expect(shouldShowAgentChat({ role: "hr" }, "/")).toBe(false);
    expect(shouldShowAgentChat({ role: "tech_lead" }, "/search")).toBe(false);
    expect(shouldShowAgentChat({ role: "hr" }, "/job-postings/abc")).toBe(false);
    expect(shouldShowAgentChat({ role: "hr" }, "/candidate-profilex")).toBe(false);
  });

  it("ẩn trên màn hình đăng nhập / đăng ký, kể cả khi còn user trong localStorage", () => {
    expect(shouldShowAgentChat({ role: "hr" }, "/login")).toBe(false);
    expect(shouldShowAgentChat({ role: "hr" }, "/register")).toBe(false);
  });

  it("ẩn trên trang careers công khai và trang onboarding", () => {
    expect(shouldShowAgentChat({ role: "hr" }, "/careers")).toBe(false);
    expect(shouldShowAgentChat({ role: "hr" }, "/careers/senior-ml-3f9a2b1c")).toBe(false);
    expect(shouldShowAgentChat({ role: "hr" }, "/onboarding/company")).toBe(false);
  });

  it("ẩn khi chưa đăng nhập hoặc là admin", () => {
    expect(shouldShowAgentChat(null, "/")).toBe(false);
    expect(shouldShowAgentChat({ role: "admin" }, "/admin")).toBe(false);
  });
});

describe("AgentChatDrawer", () => {
  it("vẽ nút mở chat trên trang ứng viên", () => {
    pathname = "/candidate-profile/enriched";
    user = { role: "hr" };
    render(<AgentChatDrawer />);
    expect(screen.getByRole("button", { name: /open agent chat/i })).toBeInTheDocument();
  });

  it("không vẽ gì trên trang đăng nhập", () => {
    pathname = "/login";
    user = { role: "hr" };
    render(<AgentChatDrawer />);
    expect(screen.queryByRole("button", { name: /open agent chat/i })).toBeNull();
  });
});

describe("AgentChatDrawer — phiên theo ứng viên và câu hỏi gợi ý", () => {
  it("mở trên trang ứng viên: header ghi rõ ứng viên nào, và có 4 câu mở đầu bấm là gửi", () => {
    pathname = "/candidate-profile/enriched";
    user = { role: "hr" };
    chatState = { ...chatState, isOpen: true, activeCandidate: "8b5c4334-0000-4000-8000-000000000000" };
    render(<AgentChatDrawer />);
    expect(screen.getByText("About Candidate #8b5c4334")).toBeInTheDocument();
    const starters = screen.getAllByRole("button").filter((b) => /strengths|missing|interview|risks/i.test(b.textContent ?? ""));
    expect(starters).toHaveLength(4);
    fireEvent.click(starters[0]);
    expect(sendMessage).toHaveBeenCalledWith("Summarise their standout strengths");
  });

  it("tech lead không thấy câu mở đầu dính danh tính, thay bằng đánh giá qua GitHub", () => {
    pathname = "/candidate-profile/enriched";
    user = { role: "tech_lead" };
    chatState = { ...chatState, isOpen: true, activeCandidate: "8b5c4334-0000-4000-8000-000000000000" };
    render(<AgentChatDrawer />);
    expect(screen.getByRole("button", { name: /GitHub/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /standout strengths/ })).toBeNull();
  });

  it("câu trả lời văn bản hiện dạng markdown và kèm gợi ý hỏi tiếp", () => {
    pathname = "/candidate-profile/enriched";
    user = { role: "hr" };
    chatState = {
      ...chatState,
      isOpen: true,
      activeCandidate: "8b5c4334-0000-4000-8000-000000000000",
      messages: [
        { id: "1", role: "user", content: "điểm mạnh?" },
        { id: "2", role: "assistant", content: JSON.stringify({ summary: "Mạnh về **Python**.", candidates: [], suggestions: ["Có rủi ro gì?"] }), suggestions: ["Có rủi ro gì?"] },
      ],
      suggestions: ["Có rủi ro gì?"],
    };
    render(<AgentChatDrawer />);
    expect(screen.getByText("Python")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Có rủi ro gì?" }));
    expect(sendMessage).toHaveBeenCalledWith("Có rủi ro gì?");
  });

  it("nút Cuộc trò chuyện mới xoá phiên hiện tại", () => {
    pathname = "/candidate-profile/enriched";
    user = { role: "hr" };
    chatState = { ...chatState, isOpen: true, activeCandidate: "abc", messages: [{ id: "1", role: "user", content: "hi" }] };
    render(<AgentChatDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /new conversation/i }));
    expect(resetSession).toHaveBeenCalled();
  });
});
