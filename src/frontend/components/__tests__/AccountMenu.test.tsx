/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
const logout = vi.fn();
const setPreference = vi.fn();
let preference = "system";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Emma Watson", email: "emma@acme.example", role: "hr", company_name: "Acme" },
    logout,
  }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ preference, setPreference, resolved: "light" }),
}));

import { AccountMenu } from "../AccountMenu";

beforeEach(() => {
  push.mockReset();
  logout.mockReset();
  setPreference.mockReset();
  preference = "system";
});
afterEach(cleanup);

describe("AccountMenu", () => {
  it("hiện tên, role và công ty trên nút; mở ra thì thêm email", () => {
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger).toHaveTextContent("Emma Watson");
    expect(trigger).toHaveTextContent("HR Manager · Acme");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toHaveTextContent("emma@acme.example");
  });

  it("đổi theme ngay trong menu", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));
    expect(setPreference).toHaveBeenCalledWith("dark");
  });

  it("Settings điều hướng, Log out đăng xuất, và menu đóng lại", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
    expect(push).toHaveBeenCalledWith("/settings");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
  });

  it("Escape đóng menu", () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
