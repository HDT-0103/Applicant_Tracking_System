/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const updateProfile = vi.fn();
const changePassword = vi.fn();
const setPreference = vi.fn();
let user: Record<string, unknown> = {
  name: "Emma", email: "emma@acme.example", role: "hr",
  company_name: "Acme", company_website: "https://acme.example", has_password: true,
};

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ user, updateProfile, changePassword }),
}));
vi.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => ({ preference: "system", setPreference, resolved: "light" }),
}));
vi.mock("../../../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import SettingsPage from "../page";

beforeEach(() => {
  updateProfile.mockReset().mockResolvedValue(undefined);
  changePassword.mockReset().mockResolvedValue(undefined);
  setPreference.mockReset();
  user = {
    name: "Emma", email: "emma@acme.example", role: "hr",
    company_name: "Acme", company_website: "https://acme.example", has_password: true,
  };
});
afterEach(cleanup);

describe("Settings", () => {
  it("điền sẵn hồ sơ hiện tại; email và role chỉ đọc", () => {
    render(<SettingsPage />);
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Emma");
    expect((screen.getByLabelText("Company name") as HTMLInputElement).value).toBe("Acme");
    expect(screen.getByText("emma@acme.example")).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it("lưu hồ sơ với giá trị đã cắt khoảng trắng và báo đã lưu", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "  Emma W. " } });
    fireEvent.change(screen.getByLabelText(/company website/i), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ name: "Emma W.", company_name: "Acme", company_website: "" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/saved/i);
  });

  it("đổi mật khẩu: hai ô mới phải khớp, rồi mới gọi backend", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-secret" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secret-1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);
    expect(changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-secret-1" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith("old-secret", "new-secret-1"));
  });

  it("tài khoản Google không có form đổi mật khẩu", () => {
    user = { ...user, has_password: false };
    render(<SettingsPage />);
    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(screen.getByText(/signs in with Google/)).toBeInTheDocument();
  });

  it("chọn theme ở đây cũng đổi được", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));
    expect(setPreference).toHaveBeenCalledWith("dark");
  });
});
