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
import { cleanup, render, screen } from "@testing-library/react";

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
vi.mock("../../hooks/useAgentChat", () => ({
  useAgentChat: () => ({
    messages: [],
    isLoading: false,
    isOpen: false,
    setIsOpen: vi.fn(),
    sendMessage: vi.fn(),
    retry: vi.fn(),
  }),
}));

import { AgentChatDrawer, shouldShowAgentChat } from "../AgentChatDrawer";

afterEach(cleanup);

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
