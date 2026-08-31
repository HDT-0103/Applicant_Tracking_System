/**
 * Vòng đời phiên đăng nhập trong httpClient.
 *
 * Đây là phần từng gây ra lỗi khó chịu nhất: người dùng lâu ngày quay lại,
 * app cho vào thẳng vì token vẫn còn trong localStorage, rồi mọi thao tác đều
 * hỏng mà không có lối thoát nào ngoài xoá cache thủ công.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  clearStoredTokens,
  httpClient,
  setSessionExpiredHandler,
  setStoredTokens,
} from "../httpClient";

// localStorage tối giản — môi trường test không có DOM.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

/** JWT thật với hạn cho trước (chữ ký giả — client không xác thực chữ ký). */
function makeToken(expOffsetSeconds: number): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: "u1", exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }),
    "chu-ky-gia",
  ].join(".");
}

const ALIVE = () => makeToken(3600);
const DEAD = () => makeToken(-3600);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
  vi.restoreAllMocks();
});

describe("ApiError phân biệt 401 với 403", () => {
  it("401 = chưa xác thực", () => {
    const err = new ApiError("hết hạn", 401);
    expect(err.isUnauthenticated).toBe(true);
    expect(err.isForbidden).toBe(false);
  });

  it("403 = đã xác thực nhưng không đủ quyền", () => {
    // Phân biệt được điều này mới tránh được vòng lặp: đá về đăng nhập, đăng
    // nhập lại, vẫn 403, lại đá ra.
    const err = new ApiError("Role 'admin' is not permitted", 403);
    expect(err.isForbidden).toBe(true);
    expect(err.isUnauthenticated).toBe(false);
  });
});

describe("token còn hạn", () => {
  it("gửi kèm Authorization và không gọi refresh", async () => {
    setStoredTokens(ALIVE(), ALIVE());
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpClient("/api/x")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toMatch(/^Bearer /);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("access hết hạn nhưng refresh còn", () => {
  it("gia hạn ngầm rồi gọi tiếp, người dùng không thấy gì", async () => {
    setStoredTokens(DEAD(), ALIVE());
    const fetchMock = vi
      .fn()
      // lượt 1: gọi /api/auth/refresh
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: ALIVE(), refreshToken: ALIVE() }),
      )
      // lượt 2: request thật, với token mới
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(httpClient("/api/x")).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[0][0]).toContain("/api/auth/refresh");
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("cả hai token đều chết — tình huống 'lâu lắm mới quay lại'", () => {
  it("báo hết phiên và KHÔNG gửi request vô ích", async () => {
    setStoredTokens(DEAD(), DEAD());
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await httpClient("/api/x").catch(() => undefined);

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("refresh bị server từ chối cũng báo hết phiên", async () => {
    setStoredTokens(DEAD(), ALIVE());
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid token" }));
    vi.stubGlobal("fetch", fetchMock);

    await httpClient("/api/x").catch(() => undefined);

    expect(onExpired).toHaveBeenCalled();
  });
});

describe("chưa từng đăng nhập", () => {
  it("không báo hết phiên — người lạ ghé trang public không bị đá đi", async () => {
    clearStoredTokens();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ok: true })));

    await httpClient("/api/x").catch(() => undefined);

    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("403 không được coi là hết phiên", () => {
  it("ném ApiError 403 và KHÔNG đăng xuất", async () => {
    // Chính là tình huống tài khoản admin mở màn hình nghiệp vụ. Đăng xuất ở
    // đây là sai: phiên vẫn tốt, chỉ là role không được phép.
    setStoredTokens(ALIVE(), ALIVE());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(403, { detail: "Role 'admin' is not permitted for this action" }),
      ),
    );

    await expect(httpClient("/api/x")).rejects.toMatchObject({
      status: 403,
      message: "Role 'admin' is not permitted for this action",
    });
    expect(onExpired).not.toHaveBeenCalled();
  });
});
