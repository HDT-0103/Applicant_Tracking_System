/**
 * @vitest-environment jsdom
 */
/**
 * HR chọn Tech Lead vào hội đồng chấm của một tin tuyển dụng.
 *
 * Hội đồng quyết định hai thứ cùng lúc: ai được XEM hồ sơ (ranh giới bảo mật,
 * vì hồ sơ chứa PII) và mẫu số của ngưỡng 80%. Nên điều các test dưới đây giữ
 * là HR luôn nhìn thấy hệ quả của lựa chọn, chứ không chỉ thấy một danh sách.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const getPanel = vi.fn();
const listAvailableReviewers = vi.fn();
const invitePanelMember = vi.fn();
const removePanelMember = vi.fn();

vi.mock("../../services/panelService", () => ({
  getPanel: (...a: unknown[]) => getPanel(...a),
  listAvailableReviewers: (...a: unknown[]) => listAvailableReviewers(...a),
  invitePanelMember: (...a: unknown[]) => invitePanelMember(...a),
  removePanelMember: (...a: unknown[]) => removePanelMember(...a),
}));

import { ReviewPanelPicker } from "../ReviewPanelPicker";

const member = (id: string, name: string) => ({
  reviewer_id: id,
  name,
  email: `${id}@smartats.com`,
  invited_at: "2026-09-01T00:00:00Z",
});

afterEach(cleanup);

beforeEach(() => {
  getPanel.mockReset().mockResolvedValue([]);
  listAvailableReviewers
    .mockReset()
    .mockResolvedValue([member("tl-1", "An"), member("tl-2", "Bảo")]);
  invitePanelMember.mockReset();
  removePanelMember.mockReset();
});

describe("ReviewPanelPicker", () => {
  it("asks for nothing until the posting has been saved", () => {
    render(<ReviewPanelPicker jobPostingId={null} />);
    expect(screen.getByText(/Save this posting first/)).toBeInTheDocument();
    expect(getPanel).not.toHaveBeenCalled();
  });

  it("warns that an empty panel leaves applications unreviewed", async () => {
    render(<ReviewPanelPicker jobPostingId="job-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be published/);
  });

  it("spells out how many approvals the chosen panel will need", async () => {
    // 5 người → ceil(5 * 0.8) = 4. HR đang quyết định một con số, không chỉ
    // đang thêm tên vào danh sách.
    getPanel.mockResolvedValue(
      ["a", "b", "c", "d", "e"].map((x) => member(`tl-${x}`, `TL ${x}`)),
    );
    render(<ReviewPanelPicker jobPostingId="job-1" />);
    expect(await screen.findByText("4 of 5")).toBeInTheDocument();
  });

  it("invites a reviewer and reports the new size upward", async () => {
    const onCountChange = vi.fn();
    invitePanelMember.mockResolvedValue([member("tl-1", "An")]);
    render(<ReviewPanelPicker jobPostingId="job-1" onCountChange={onCountChange} />);

    fireEvent.click(await screen.findByRole("button", { name: /An/ }));

    expect(invitePanelMember).toHaveBeenCalledWith("job-1", "tl-1");
    // Trang tạo tin dựa vào con số này để khoá nút Publish.
    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(1));
  });

  it("does not offer someone already on the panel", async () => {
    getPanel.mockResolvedValue([member("tl-1", "An")]);
    render(<ReviewPanelPicker jobPostingId="job-1" />);

    await screen.findByText("tl-1@smartats.com");
    expect(screen.queryByRole("button", { name: /^An$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bảo/ })).toBeInTheDocument();
  });

  it("removes a reviewer", async () => {
    getPanel.mockResolvedValue([member("tl-1", "An")]);
    removePanelMember.mockResolvedValue([]);
    render(<ReviewPanelPicker jobPostingId="job-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove An" }));
    expect(removePanelMember).toHaveBeenCalledWith("job-1", "tl-1");
  });

  it("surfaces a failed change instead of silently reverting", async () => {
    invitePanelMember.mockRejectedValue(new Error("Only HR may invite reviewers"));
    render(<ReviewPanelPicker jobPostingId="job-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /An/ }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(
        "Only HR may invite reviewers",
      ),
    );
  });
});
