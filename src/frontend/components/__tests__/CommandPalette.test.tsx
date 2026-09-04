/**
 * @vitest-environment jsdom
 */
/**
 * Bảng lệnh ⌘K: nhảy tới ứng viên / tin trong phạm vi của mình, hoặc màn hình.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const listCandidateOptions = vi.fn();
const listJobPostings = vi.fn();
let role = "hr";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: { role, name: "X" } }) }));
vi.mock("../../services/catalogService", () => ({
  listCandidateOptions: () => listCandidateOptions(),
  listJobPostings: () => listJobPostings(),
}));

import { CommandPalette, filterItems, type PaletteItem } from "../CommandPalette";
import { Search } from "lucide-react";

beforeEach(() => {
  push.mockReset();
  role = "hr";
  listCandidateOptions.mockReset().mockResolvedValue([
    { candidate_uuid: "1a2b3c4d-0000-4000-8000-000000000000", full_name: "Trần Bảo" },
    { candidate_uuid: "9f8e7d6c-0000-4000-8000-000000000000", full_name: "***" },
  ]);
  listJobPostings.mockReset().mockResolvedValue([
    { id: "job-1", job_title: "Senior ML Engineer", status: "PUBLISHED", applicant_count: 3 },
  ]);
});
afterEach(cleanup);

describe("filterItems", () => {
  const items: PaletteItem[] = [
    { id: "a", group: "Go to", label: "Dashboard", href: "/", Icon: Search },
    { id: "b", group: "Job postings", label: "Senior ML Engineer", hint: "PUBLISHED · 3 applicants", href: "/j", Icon: Search },
  ];
  it("rỗng thì giữ tất cả; khớp theo nhãn hoặc gợi ý, không phân biệt hoa thường", () => {
    expect(filterItems(items, "")).toHaveLength(2);
    expect(filterItems(items, "ml eng").map((i) => i.id)).toEqual(["b"]);
    expect(filterItems(items, "published").map((i) => i.id)).toEqual(["b"]);
    expect(filterItems(items, "zzz")).toHaveLength(0);
  });
});

describe("CommandPalette", () => {
  it("không vẽ gì khi đóng", () => {
    render(<CommandPalette open={false} onClose={() => undefined} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("liệt kê màn hình, ứng viên (nhãn ẩn danh khi bị che) và tin trong phạm vi", async () => {
    render(<CommandPalette open onClose={() => undefined} />);
    expect(screen.getByRole("option", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /new job posting/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /Trần Bảo/ })).toBeInTheDocument();
    // "***" của ABAC không được lọt ra bảng lệnh.
    expect(screen.getByRole("option", { name: /Candidate #9f8e7d6c/ })).toBeInTheDocument();
    expect(screen.queryByText("***")).toBeNull();
    expect(screen.getByRole("option", { name: /Senior ML Engineer/ })).toBeInTheDocument();
  });

  it("gõ để lọc, Enter để đi tới mục đang chọn, rồi đóng", async () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} />);
    await screen.findByRole("option", { name: /Trần Bảo/ });

    const input = screen.getByRole("textbox", { name: /search/i });
    fireEvent.change(input, { target: { value: "senior ml" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    fireEvent.keyDown(input, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/job-postings/job-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("tech lead không thấy lệnh tạo tin", () => {
    role = "tech_lead";
    render(<CommandPalette open onClose={() => undefined} />);
    expect(screen.queryByRole("option", { name: /new job posting/i })).toBeNull();
  });

  it("admin chỉ có điều hướng, không gọi endpoint nghiệp vụ", () => {
    role = "admin";
    render(<CommandPalette open onClose={() => undefined} />);
    expect(screen.getByRole("option", { name: /admin panel/i })).toBeInTheDocument();
    expect(listCandidateOptions).not.toHaveBeenCalled();
  });
});
