import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredApplication,
  readStoredApplication,
  writeStoredApplication,
  type StoredApplicationRef,
} from "../applicationStorage";

const REF: StoredApplicationRef = {
  applicationId: "app-1",
  candidateUuid: "cand-1",
  resumeId: "res-1",
  submittedAt: "2026-07-22T00:00:00.000Z",
};

// Minimal in-memory localStorage — the test env has no DOM.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe("applicationStorage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: makeLocalStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing was stored for the job", () => {
    expect(readStoredApplication("job-1")).toBeNull();
  });

  it("stores and reads back a ref, scoped per job", () => {
    writeStoredApplication("job-1", REF);
    expect(readStoredApplication("job-1")).toEqual(REF);
    expect(readStoredApplication("job-2")).toBeNull();
  });

  it("keeps other jobs when one entry is cleared", () => {
    writeStoredApplication("job-1", REF);
    writeStoredApplication("job-2", { ...REF, applicationId: "app-2" });
    clearStoredApplication("job-1");
    expect(readStoredApplication("job-1")).toBeNull();
    expect(readStoredApplication("job-2")?.applicationId).toBe("app-2");
  });

  it("survives corrupt storage contents", () => {
    window.localStorage.setItem("smartats_my_applications", "not-json{");
    expect(readStoredApplication("job-1")).toBeNull();
    writeStoredApplication("job-1", REF);
    expect(readStoredApplication("job-1")).toEqual(REF);
  });

  it("ignores incomplete refs", () => {
    window.localStorage.setItem(
      "smartats_my_applications",
      JSON.stringify({ "job-1": { applicationId: "", candidateUuid: "" } }),
    );
    expect(readStoredApplication("job-1")).toBeNull();
  });

  it("is a no-op without a window (SSR)", () => {
    vi.unstubAllGlobals();
    expect(readStoredApplication("job-1")).toBeNull();
    expect(() => writeStoredApplication("job-1", REF)).not.toThrow();
  });
});
