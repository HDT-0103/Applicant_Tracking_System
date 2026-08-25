/**
 * Session guarding on the direct-PostgREST data path.
 *
 * The bug this closes: the anon key stays valid regardless of our own session,
 * so a query issued after the app session expired can SUCCEED and return rows
 * the user should no longer see. Reacting to the response is not enough —
 * there is often no error to react to. The check has to happen first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `lib/supabase` throws at import time when NEXT_PUBLIC_* are absent, and
// vitest does not load .env. Mock it: this file tests the session gate, not
// PostgREST, so a real client would add a dependency on secrets for no gain.
vi.mock("../supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { DataError, db, guarded, hasLiveSession } from "../db";
import {
  clearStoredTokens,
  setSessionExpiredHandler,
  setStoredTokens,
} from "../../services/httpClient";

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

function makeToken(expOffsetSeconds: number): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: "u1", exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }),
    "signature",
  ].join(".");
}

const ALIVE = () => makeToken(3600);
const DEAD = () => makeToken(-3600);

let onExpired: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorage());
  vi.stubGlobal("window", { localStorage: globalThis.localStorage });
  onExpired = vi.fn<() => void>();
  setSessionExpiredHandler(onExpired);
});

afterEach(() => {
  setSessionExpiredHandler(null);
  vi.unstubAllGlobals();
});

describe("hasLiveSession", () => {
  it("access token still valid", () => {
    setStoredTokens(ALIVE(), ALIVE());
    expect(hasLiveSession()).toBe(true);
  });

  it("access expired but refresh valid still counts as signed in", () => {
    // Someone who left a tab open over lunch should not be ejected; the next
    // API call renews the token silently.
    setStoredTokens(DEAD(), ALIVE());
    expect(hasLiveSession()).toBe(true);
  });

  it("both expired", () => {
    setStoredTokens(DEAD(), DEAD());
    expect(hasLiveSession()).toBe(false);
  });

  it("never signed in", () => {
    clearStoredTokens();
    expect(hasLiveSession()).toBe(false);
  });
});

describe("db() gate", () => {
  it("returns a usable client for a live session", () => {
    setStoredTokens(ALIVE(), ALIVE());
    expect(typeof db().from).toBe("function");
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("throws and signs out when the session is dead", () => {
    setStoredTokens(DEAD(), DEAD());
    expect(() => db()).toThrowError(DataError);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("the thrown error is tagged as a session problem, not a query problem", () => {
    // Screens branch on this to decide between "sign in again" and
    // "something went wrong loading this".
    setStoredTokens(DEAD(), DEAD());
    try {
      db();
      expect.unreachable("db() should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DataError);
      expect((err as DataError).isSessionExpired).toBe(true);
    }
  });
});

describe("guarded()", () => {
  it("passes data through on success", async () => {
    setStoredTokens(ALIVE(), ALIVE());
    const rows = [{ id: 1 }];
    await expect(
      guarded("load things", async () => ({ data: rows, error: null })),
    ).resolves.toBe(rows);
  });

  it("never runs the query when the session is dead", async () => {
    // The heart of the fix: the anon key would happily serve this request.
    setStoredTokens(DEAD(), DEAD());
    const run = vi.fn();

    await expect(guarded("load things", run as never)).rejects.toThrowError(
      DataError,
    );
    expect(run).not.toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("wraps a PostgREST error with the label so the message is actionable", async () => {
    setStoredTokens(ALIVE(), ALIVE());
    await expect(
      guarded("load candidates", async () => ({
        data: null,
        error: { message: "permission denied for table candidates" },
      })),
    ).rejects.toThrowError(/Could not load candidates: permission denied/);
  });

  it("a query failure is NOT reported as a session problem", async () => {
    // Signing the user out because one table denied access would be both
    // wrong and infuriating — they would sign back in to the same error.
    setStoredTokens(ALIVE(), ALIVE());
    try {
      await guarded("load candidates", async () => ({
        data: null,
        error: { message: "boom" },
      }));
      expect.unreachable("guarded() should have thrown");
    } catch (err) {
      expect((err as DataError).kind).toBe("query_failed");
      expect(onExpired).not.toHaveBeenCalled();
    }
  });
});
