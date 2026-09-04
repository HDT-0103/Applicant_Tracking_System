/**
 * @vitest-environment jsdom
 */
/**
 * Nút chat với agent chỉ xuất hiện trong workspace.
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
  it("hiện trong workspace cho hr và tech_lead", () => {
    expect(shouldShowAgentChat({ role: "hr" }, "/")).toBe(true);
    expect(shouldShowAgentChat({ role: "tech_lead" }, "/search")).toBe(true);
    expect(shouldShowAgentChat({ role: "hr" }, "/job-postings/abc")).toBe(true);
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
  it("vẽ nút mở chat trên dashboard", () => {
    pathname = "/";
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
