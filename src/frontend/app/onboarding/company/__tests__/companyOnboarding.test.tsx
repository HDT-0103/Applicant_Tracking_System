/**
 * @vitest-environment jsdom
 */
/**
 * Màn hình hoàn tất công ty. Hai điều phải giữ: gửi đúng giá trị đã cắt
 * khoảng trắng (website rỗng thành null, không phải chuỗi rỗng), và sau khi
 * lưu thì đưa về đúng trang đích của role.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const updateCompany = vi.fn();
const replace = vi.fn();
let user: { name: string; role: string; company_name?: string | null } = {
  name: "Jane",
  role: "hr",
  company_name: null,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({ user, updateCompany }),
  landingPathForRole: (role?: string) => (role === "admin" ? "/admin" : "/"),
}));

import CompanyOnboardingPage from "../page";

describe("hoàn tất công ty sau lần đăng nhập Google đầu tiên", () => {
  beforeEach(() => {
    updateCompany.mockReset();
    updateCompany.mockResolvedValue(undefined);
    replace.mockReset();
    user = { name: "Jane", role: "hr", company_name: null };
  });
  afterEach(cleanup);

  it("không gửi khi chưa có tên công ty", () => {
    render(<CompanyOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    // Ô công ty là `required` nên submit bị chặn ngay ở form.
    expect(updateCompany).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("gửi tên công ty và website đã cắt khoảng trắng, rồi về workspace", async () => {
    render(<CompanyOnboardingPage />);
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "  Acme " } });
    fireEvent.change(screen.getByLabelText(/company website/i), {
      target: { value: " https://acme.example " },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(updateCompany).toHaveBeenCalledWith({
        company_name: "Acme",
        company_website: "https://acme.example",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("website bỏ trống gửi đi là null, không phải chuỗi rỗng", async () => {
    render(<CompanyOnboardingPage />);
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(updateCompany).toHaveBeenCalledWith({ company_name: "Acme", company_website: null }),
    );
  });

  it("người đã có công ty mở lại thì thấy giá trị cũ để sửa", () => {
    user = { name: "Jane", role: "hr", company_name: "Acme" };
    render(<CompanyOnboardingPage />);
    expect((screen.getByLabelText("Company name") as HTMLInputElement).value).toBe("Acme");
  });
});
