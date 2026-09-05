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
  fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme" } });
}

const COMPANY = { company_name: "Acme", company_website: null };

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
        COMPANY,
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
        COMPANY,
      ),
    );
  });

  it("không gửi đi khi thiếu tên công ty", async () => {
    // V009: tài khoản nội bộ phải thuộc về một công ty. Backend cũng từ chối
    // (422), nhưng người dùng phải được nói rõ ngay tại chỗ.
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "jane@company.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // Ô công ty là `required` nên trình duyệt chặn ngay lúc submit; JSDOM cũng
    // vậy, nên không có lời gọi nào đi ra là đủ để khẳng định.
    expect(registerWithEmailPassword).not.toHaveBeenCalled();
  });

  it("gửi website công ty khi có, dạng đã cắt khoảng trắng", async () => {
    render(<RegisterPage />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/company website/i), {
      target: { value: "  https://acme.example " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(registerWithEmailPassword).toHaveBeenCalledWith(
        "Jane Doe",
        "jane@company.com",
        "secret123",
        "hr",
        { company_name: "Acme", company_website: "https://acme.example" },
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
