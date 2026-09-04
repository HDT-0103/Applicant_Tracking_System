/**
 * @vitest-environment jsdom
 */
/**
 * Trang chi tiết tin tuyển dụng.
 *
 * Ba điều phải giữ: link nộp hồ sơ LUÔN hiện (trước đây chỉ có ở bước 3 của
 * wizard), tech lead thấy hội đồng nhưng không có nút mời/gỡ hay nút Edit,
 * và tab "Candidate view" nhúng đúng trang ứng viên ở chế độ xem trước.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const getJobPosting = vi.fn();
const getPanel = vi.fn();
let role = "hr";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useParams: () => ({ id: "3f9a2b1c-4d5e-4f6a-8b9c-0d1e2f3a4b5c" }),
  usePathname: () => "/job-postings/3f9a2b1c-4d5e-4f6a-8b9c-0d1e2f3a4b5c",
}));
vi.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(role), user: { role } }),
}));
vi.mock("../../../../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../components/ReviewPanelPicker", () => ({
  ReviewPanelPicker: () => <div data-testid="panel-picker">picker</div>,
}));
vi.mock("../../../../services/catalogService", () => ({
  getJobPosting: (...a: unknown[]) => getJobPosting(...a),
}));
vi.mock("../../../../services/panelService", () => ({
  getPanel: (...a: unknown[]) => getPanel(...a),
}));

import JobPostingDetailPage from "../page";

const JOB = {
  id: "3f9a2b1c-4d5e-4f6a-8b9c-0d1e2f3a4b5c",
  job_title: "Senior ML Engineer",
  department: "AI",
  location: "HCMC",
  work_mode: "Hybrid",
  employment_type: "Full-time",
  seniority_level: "Senior",
  target_openings: 2,
  salary_min: 3000,
  salary_max: 5000,
  must_have_skills: ["Python"],
  nice_to_have_skills: [],
  description: "Build models.",
  key_responsibilities: null,
  requirements: "5 years",
  nice_to_have_qualifications: null,
  status: "DRAFT",
  posted_at: null,
  expires_at: null,
  created_at: "2026-09-01T00:00:00Z",
  created_by_name: "Mai",
  created_by_company: "Acme",
};

describe("trang chi tiết tin tuyển dụng", () => {
  beforeEach(() => {
    getJobPosting.mockReset().mockResolvedValue(JOB);
    getPanel.mockReset().mockResolvedValue([
      { reviewer_id: "tl-1", name: "An", email: "an@acme.example", invited_at: "" },
    ]);
    role = "hr";
  });
  afterEach(cleanup);

  it("luôn hiện link nộp hồ sơ, kể cả với tin DRAFT khi vào lại", async () => {
    render(<JobPostingDetailPage />);
    const input = (await screen.findByDisplayValue(/\/careers\/senior-ml-engineer-3f9a2b1c/)) as HTMLInputElement;
    expect(input.value).toContain(JOB.id);
  });

  it("hiện thông tin HR đã nhập và ai đăng tin kèm công ty", async () => {
    render(<JobPostingDetailPage />);
    expect(await screen.findByText("Senior ML Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Posted by Mai · Acme/)).toBeInTheDocument();
    expect(screen.getByText("Build models.")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("HR thấy bộ chọn hội đồng và nút Edit", async () => {
    render(<JobPostingDetailPage />);
    expect(await screen.findByTestId("panel-picker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("tech lead chỉ đọc hội đồng, không có nút mời/gỡ hay Edit", async () => {
    role = "tech_lead";
    render(<JobPostingDetailPage />);
    expect(await screen.findByText("An")).toBeInTheDocument();
    expect(screen.queryByTestId("panel-picker")).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("tab Candidate view nhúng đúng trang ứng viên ở chế độ xem trước", async () => {
    render(<JobPostingDetailPage />);
    await screen.findByText("Senior ML Engineer");
    fireEvent.click(screen.getByRole("tab", { name: /candidate view/i }));
    await waitFor(() => {
      const frame = screen.getByTitle("Candidate view") as HTMLIFrameElement;
      expect(frame.getAttribute("src")).toBe(`/careers/senior-ml-engineer-${JOB.id}?preview=1`);
    });
  });

  it("tin ngoài phạm vi báo đúng câu backend trả, không phải màn hình trắng", async () => {
    getJobPosting.mockRejectedValue(new Error("Job posting not found."));
    render(<JobPostingDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Job posting not found.");
  });
});
