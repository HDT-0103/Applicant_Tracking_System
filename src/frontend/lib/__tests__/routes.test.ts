import { describe, expect, it } from "vitest";
import { isAuthRoute, isPublicRoute } from "../routes";

const JOB_LINK = "/careers/senior-ml-engineer-3f9a2b1c-4d5e-4f6a-8b9c-0d1e2f3a4b5c";

describe("isPublicRoute", () => {
  it("lets a candidate with no account reach a shared job link", () => {
    expect(isPublicRoute(JOB_LINK)).toBe(true);
  });

  it("lets a candidate reach the public job board", () => {
    expect(isPublicRoute("/careers")).toBe(true);
    expect(isPublicRoute("/careers/")).toBe(true);
  });

  it("covers the sign-in screens", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/register")).toBe(true);
  });

  it("keeps every HR surface behind the login", () => {
    for (const path of ["/", "/admin", "/schedule", "/job-postings/create",
                        "/candidate-profile", "/candidate-profile/enriched", "/ai-agent-prompt"]) {
      expect(isPublicRoute(path), path).toBe(false);
    }
  });

  it("does not leak on a lookalike prefix", () => {
    expect(isPublicRoute("/careers-admin")).toBe(false);
    expect(isPublicRoute("/careersadmin")).toBe(false);
    expect(isPublicRoute("/xcareers")).toBe(false);
  });

  it("handles a missing pathname", () => {
    expect(isPublicRoute(null)).toBe(false);
    expect(isPublicRoute(undefined)).toBe(false);
    expect(isPublicRoute("")).toBe(false);
  });
});

describe("isAuthRoute", () => {
  it("is true only for the sign-in screens", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/register")).toBe(true);
  });

  it("is false for careers, so a signed-in HR can preview it", () => {
    expect(isAuthRoute("/careers")).toBe(false);
    expect(isAuthRoute(JOB_LINK)).toBe(false);
  });

  it("is false for protected pages", () => {
    expect(isAuthRoute("/admin")).toBe(false);
    expect(isAuthRoute("/")).toBe(false);
  });
});

describe("guard behaviour the two predicates encode", () => {
  const wouldRedirectToLogin = (path: string, signedIn: boolean) =>
    !signedIn && !isPublicRoute(path);

  const wouldRedirectToWorkspace = (path: string, signedIn: boolean) =>
    signedIn && isAuthRoute(path);

  it("an anonymous candidate is never sent to login from a job link", () => {
    expect(wouldRedirectToLogin(JOB_LINK, false)).toBe(false);
    expect(wouldRedirectToLogin("/careers", false)).toBe(false);
  });

  it("an anonymous visitor is still sent to login from HR pages", () => {
    expect(wouldRedirectToLogin("/admin", false)).toBe(true);
    expect(wouldRedirectToLogin("/", false)).toBe(true);
  });

  it("a signed-in HR is not bounced off the careers preview", () => {
    expect(wouldRedirectToWorkspace(JOB_LINK, true)).toBe(false);
    expect(wouldRedirectToWorkspace("/careers", true)).toBe(false);
  });

  it("a signed-in HR is still bounced off the login screen", () => {
    expect(wouldRedirectToWorkspace("/login", true)).toBe(true);
    expect(wouldRedirectToWorkspace("/register", true)).toBe(true);
  });
});
