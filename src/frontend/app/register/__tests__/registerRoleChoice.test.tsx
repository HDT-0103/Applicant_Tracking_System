/**
 * @vitest-environment jsdom
 */
/**
 * Màn hình đăng ký cho người dùng tự chọn vai trò.
 *
 * Hai hướng hỏng đều tệ và đều im lặng. Gửi thiếu `role` thì backend mặc định
 * `hr`, nên một tech lead vừa đăng ký sẽ thấy đầy đủ PII ứng viên — đúng thứ
 * ABAC sinh ra để chặn. Gửi thừa một role thứ ba thì backend trả 422 và người
 * dùng chỉ thấy "Registration failed" không rõ vì sao.
 *
 * Vì vậy test khoá đúng hai điều: đúng giá trị người dùng chọn được gửi đi, và
 * danh sách lựa chọn không bao giờ có `admin`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const registerWithEmailPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ registerWithEmailPassword }),
}));

import RegisterPage from "../page";

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "jane@company.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
}

describe("chọn vai trò khi đăng ký", () => {
  beforeEach(() => {
    registerWithEmailPassword.mockReset();
    registerWithEmailPassword.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("mặc định là hr khi người dùng không đụng vào ô chọn", async () => {
    render(<RegisterPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(registerWithEmailPassword).toHaveBeenCalledWith(
        "Jane Doe",
        "jane@company.com",
        "secret123",
        "hr",
      ),
    );
  });

  it("gửi tech_lead khi người dùng chọn Tech Lead", async () => {
    render(<RegisterPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByLabelText(/tech lead/i));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(registerWithEmailPassword).toHaveBeenCalledWith(
        "Jane Doe",
        "jane@company.com",
        "secret123",
        "tech_lead",
      ),
    );
  });

  it("không cho chọn admin — chỉ đúng hai lựa chọn nghiệp vụ", () => {
    render(<RegisterPage />);
    const options = screen.getAllByRole("radio");

    expect(options).toHaveLength(2);
    expect(options.map((o) => (o as HTMLInputElement).value)).toEqual(["hr", "tech_lead"]);
    expect(screen.queryByLabelText(/admin/i)).toBeNull();
  });
});
