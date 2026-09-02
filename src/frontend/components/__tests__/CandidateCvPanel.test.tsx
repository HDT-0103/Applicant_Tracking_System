/**
 * @vitest-environment jsdom
 */
/**
 * Panel CV gốc — nửa trái của Split-Screen Workspace.
 *
 * Màn hình này tồn tại để người duyệt đối chiếu phân tích của AI với tài liệu
 * thật. Nên điều các test dưới đây giữ là: tài liệu phải hiện ra được, và khi
 * không hiện được thì người dùng phải biết vì sao — "không có CV" khác hẳn
 * "hệ thống hỏng", và hai thứ đó không được trông giống nhau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const getCandidateCvLink = vi.fn();
vi.mock("../../services/candidateCvService", () => ({
  getCandidateCvLink: (...a: unknown[]) => getCandidateCvLink(...a),
}));

import { CandidateCvPanel } from "../CandidateCvPanel";

const SAS = "https://acct.blob.core.windows.net/cvs/cand-1.pdf?sig=abc";

afterEach(cleanup);
beforeEach(() => getCandidateCvLink.mockReset());

describe("CandidateCvPanel", () => {
  it("renders the document once the link arrives", async () => {
    getCandidateCvLink.mockResolvedValue(SAS);
    const { container } = render(<CandidateCvPanel candidateUuid="cand-1" />);

    await waitFor(() => {
      const frame = container.querySelector("iframe");
      expect(frame).toHaveAttribute("src", SAS);
    });
    expect(getCandidateCvLink).toHaveBeenCalledWith("cand-1");
  });

  it("says the candidate has no CV rather than showing an error", async () => {
    // 404 là trạng thái bình thường: hồ sơ chưa đính CV, hoặc người xem không
    // thuộc hội đồng. Cả hai đều không phải hệ thống hỏng.
    // `Once` chứ không phải reject vĩnh viễn: panel chỉ gọi một lần cho mỗi
    // ứng viên, và một mock reject mãi mãi để lại promise không ai nhận ở
    // những lượt render sau, thành unhandled rejection.
    getCandidateCvLink.mockRejectedValueOnce(
      new Error("CV file for this candidate was not found."),
    );
    render(<CandidateCvPanel candidateUuid="cand-1" />);

    expect(await screen.findByText(/No CV is attached/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
  });

  it("shows a real failure with a way to retry", async () => {
    getCandidateCvLink.mockRejectedValueOnce(new Error("Storage account unreachable"));
    render(<CandidateCvPanel candidateUuid="cand-1" />);

    expect(await screen.findByText("Storage account unreachable")).toBeInTheDocument();

    getCandidateCvLink.mockResolvedValue(SAS);
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(getCandidateCvLink).toHaveBeenCalledTimes(2));
  });

  it("asks for nothing when there is no candidate", () => {
    render(<CandidateCvPanel candidateUuid="" />);
    expect(getCandidateCvLink).not.toHaveBeenCalled();
    expect(screen.getByText(/No CV is attached/)).toBeInTheDocument();
  });

  it("offers open and download only once a link exists", async () => {
    getCandidateCvLink.mockResolvedValue(SAS);
    render(<CandidateCvPanel candidateUuid="cand-1" candidateName="Trần Bảo" />);

    const open = await screen.findByRole("link", { name: /Open/ });
    expect(open).toHaveAttribute("href", SAS);
    // Cùng link đã ký, không dựng lại URL ở phía client — SAS hết hạn sau 15
    // phút và chỉ máy chủ mới ký được cái mới.
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("href", SAS);
    expect(screen.getByTitle("Trần Bảo")).toBeInTheDocument();
  });

  it("reloads when the panel switches to another candidate", async () => {
    getCandidateCvLink.mockResolvedValue(SAS);
    const { rerender } = render(<CandidateCvPanel candidateUuid="cand-1" />);
    await waitFor(() => expect(getCandidateCvLink).toHaveBeenCalledWith("cand-1"));

    rerender(<CandidateCvPanel candidateUuid="cand-2" />);
    // Giữ nguyên tài liệu cũ khi đổi ứng viên là hiển thị CV của người này
    // dưới tên người kia.
    await waitFor(() => expect(getCandidateCvLink).toHaveBeenCalledWith("cand-2"));
  });
});
