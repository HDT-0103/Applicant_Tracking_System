/**
 * @vitest-environment jsdom
 */
/**
 * Hộp xác nhận cho hành động phá huỷ.
 *
 * Thay cho `window.confirm` ở hai chỗ: thu hồi phiên đăng nhập (đá người dùng
 * ra ngay lập tức) và xoá tin tuyển dụng. Cả hai đều không lùi lại được, nên
 * điều đáng giữ là: không bấm nhầm một phát ra kết quả, và trong lúc đang xử
 * lý thì không bấm thêm được lần nữa.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ConfirmDialog } from "../ConfirmDialog";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const props = {
    open: true,
    title: "Revoke this session?",
    message: "The user will be signed out immediately.",
    confirmLabel: "Revoke session",
    busy: false,
    onCancel,
    onConfirm,
    ...overrides,
  };
  const view = render(<ConfirmDialog {...props} />);
  return { onConfirm, onCancel, view };
}

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    const { view } = setup({ open: false });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("states what is about to happen, not just that something will", () => {
    setup();
    expect(screen.getByText("Revoke this session?")).toBeInTheDocument();
    expect(screen.getByText(/signed out immediately/)).toBeInTheDocument();
  });

  it("only confirms when the confirm button is pressed", () => {
    const { onConfirm, onCancel } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Revoke session" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    // Một hộp thoại phá huỷ mà chỉ thoát được bằng cách bấm trúng nút Cancel
    // là cái bẫy cho người dùng bàn phím.
    const { onCancel } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cannot be fired twice while the first attempt is running", () => {
    const { onConfirm, onCancel } = setup({ busy: true });

    const button = screen.getByRole("button", { name: /Working/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();

    // Và Escape cũng không được huỷ giữa chừng — yêu cầu đã gửi đi rồi.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
