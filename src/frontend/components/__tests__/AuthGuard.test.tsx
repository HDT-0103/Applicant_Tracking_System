/**
 * @vitest-environment jsdom
 */
/**
 * AuthGuard decides who is allowed to see what.
 *
 * It is the only place where the "admin stays in the Admin Panel, hr and
 * tech_lead use the main app" rule is enforced on the client, and the only
 * thing keeping the public careers page reachable without an account. Both
 * failure directions are bad: too strict locks candidates out of applying, too
 * loose renders a workspace to someone with no session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));

let authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { role: string; company_name?: string | null } | null;
};

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => authState,
  COMPANY_ONBOARDING_PATH: "/onboarding/company",
  // Bản sao 1-1 của luật trong AuthContext: admin không cần công ty.
  needsCompanyOnboarding: (user: { role: string; company_name?: string | null } | null) =>
    Boolean(user) && user!.role !== "admin" && !(user!.company_name && user!.company_name.trim()),
}));

import { AuthGuard } from "../AuthGuard";

function signedIn(role: string, company: string | null = "Acme") {
  authState = { isAuthenticated: true, isLoading: false, user: { role, company_name: company } };
}
function signedOut() {
  authState = { isAuthenticated: false, isLoading: false, user: null };
}

beforeEach(() => {
  replace.mockClear();
  pathname = "/";
  signedOut();
});

afterEach(cleanup);

const Protected = () => <div>workspace content</div>;

describe("while the session is still being restored", () => {
  it("shows a loading state instead of guessing", () => {
    // Rendering the workspace optimistically would flash private content;
    // redirecting optimistically would eject a user who is in fact signed in.
    authState = { isAuthenticated: false, isLoading: true, user: null };
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(screen.queryByText("workspace content")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("signed out", () => {
  it("redirects away from a protected route", () => {
    pathname = "/analytics";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("workspace content")).not.toBeInTheDocument();
  });

  it("leaves the public careers page alone", () => {
    // A candidate arriving through a shared link has no account and never
    // will. Redirecting them to /login ends the application before it starts.
    pathname = "/careers/senior-backend";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("workspace content")).toBeInTheDocument();
  });

  it("leaves the login page alone", () => {
    pathname = "/login";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  it("renders the workspace for hr", () => {
    signedIn("hr");
    pathname = "/analytics";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(screen.getByText("workspace content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the workspace for tech_lead", () => {
    // hr and tech_lead share every route; the difference between them is the
    // masking the backend applies, not the screens they can open.
    signedIn("tech_lead");
    pathname = "/analytics";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(screen.getByText("workspace content")).toBeInTheDocument();
  });

  it("bounces off the sign-in screen instead of showing a form", () => {
    signedIn("hr");
    pathname = "/login";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).toHaveBeenCalled();
  });

  it("keeps an hr user on the public careers page", () => {
    // Public is not the same as anonymous-only: recruiters preview the board
    // their candidates see.
    signedIn("hr");
    pathname = "/careers";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("workspace content")).toBeInTheDocument();
  });
});

describe("admin is confined to the Admin Panel", () => {
  it("redirects an admin away from operational screens", () => {
    signedIn("admin");
    pathname = "/analytics";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).toHaveBeenCalledWith("/admin");
    expect(screen.queryByText("workspace content")).not.toBeInTheDocument();
  });

  it("lets an admin stay inside /admin", () => {
    signedIn("admin");
    pathname = "/admin";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("workspace content")).toBeInTheDocument();
  });
});

describe("company onboarding (V009)", () => {
  it("sends a user with no company to the onboarding screen first", () => {
    // Người đăng nhập Google lần đầu: Google chỉ trả tên và email, nên đây là
    // chỗ duy nhất để hỏi công ty trước khi họ vào workspace.
    signedIn("hr", null);
    pathname = "/";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).toHaveBeenCalledWith("/onboarding/company");
    expect(screen.queryByText("workspace content")).not.toBeInTheDocument();
  });

  it("lets them stay on the onboarding screen itself", () => {
    signedIn("tech_lead", null);
    pathname = "/onboarding/company";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("workspace content")).toBeInTheDocument();
  });

  it("does not ask an admin for a company", () => {
    signedIn("admin", null);
    pathname = "/admin";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves a user who already has a company alone", () => {
    signedIn("hr", "Acme");
    pathname = "/";
    render(
      <AuthGuard>
        <Protected />
      </AuthGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("workspace content")).toBeInTheDocument();
  });
});
