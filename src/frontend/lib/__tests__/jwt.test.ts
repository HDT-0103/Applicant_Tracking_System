import { describe, expect, it } from "vitest";

import {
  decodeJwtPayload,
  isTokenExpired,
  isTokenValid,
  resolveSessionState,
} from "../jwt";

/** Dựng JWT thật (chữ ký giả — phía client không bao giờ xác thực chữ ký). */
function makeToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.chu-ky-gia`;
}

const NOW = 1_700_000_000_000; // mốc thời gian cố định, không phụ thuộc lúc chạy test
const inSeconds = (offset: number) => Math.floor(NOW / 1000) + offset;

describe("decodeJwtPayload", () => {
  it("đọc được payload", () => {
    const token = makeToken({ sub: "u1", email: "a@x.com", role: "hr", exp: 123 });
    expect(decodeJwtPayload(token)).toMatchObject({
      sub: "u1",
      email: "a@x.com",
      role: "hr",
    });
  });

  it("giữ nguyên dấu tiếng Việt", () => {
    // Base64 thô sẽ làm vỡ chữ có dấu nếu không đi qua UTF-8.
    const token = makeToken({ name: "Nguyễn Văn Hùng" });
    expect(decodeJwtPayload(token)?.["name" as keyof object]).toBe("Nguyễn Văn Hùng");
  });

  it("không ném lỗi với dữ liệu rác trong localStorage", () => {
    // Hàm này chạy lúc app khởi động — ném lỗi ở đây là màn hình trắng.
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
    expect(decodeJwtPayload("khong-phai-jwt")).toBeNull();
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a.b.c.d")).toBeNull();
    expect(decodeJwtPayload("aaa.$$$khong-base64$$$.ccc")).toBeNull();
  });

  it("payload là JSON hợp lệ nhưng không phải object -> null", () => {
    const b64 = (s: string) => Buffer.from(s).toString("base64url");
    expect(decodeJwtPayload(`x.${b64('"chuoi"')}.y`)).toBeNull();
    expect(decodeJwtPayload(`x.${b64("123")}.y`)).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("token còn hạn dài -> chưa hết", () => {
    expect(isTokenExpired(makeToken({ exp: inSeconds(3600) }), NOW)).toBe(false);
  });

  it("token đã quá hạn -> hết", () => {
    expect(isTokenExpired(makeToken({ exp: inSeconds(-1) }), NOW)).toBe(true);
  });

  it("sắp hết trong khoảng phòng hờ -> coi như đã hết", () => {
    // Còn 10 giây, dưới mức phòng hờ 30 giây. Gửi đi rất dễ bị server từ chối
    // vì lệch đồng hồ — lỗi chập chờn khó tái hiện nhất.
    expect(isTokenExpired(makeToken({ exp: inSeconds(10) }), NOW)).toBe(true);
  });

  it("còn nhiều hơn khoảng phòng hờ -> vẫn dùng được", () => {
    expect(isTokenExpired(makeToken({ exp: inSeconds(60) }), NOW)).toBe(false);
  });

  it("thiếu exp -> coi như hết hạn, KHÔNG phải sống mãi", () => {
    expect(isTokenExpired(makeToken({ sub: "u1" }), NOW)).toBe(true);
  });

  it("exp sai kiểu -> coi như hết hạn", () => {
    expect(isTokenExpired(makeToken({ exp: "1700000000" }), NOW)).toBe(true);
    expect(isTokenExpired(makeToken({ exp: null }), NOW)).toBe(true);
  });

  it("token hỏng hoặc không có -> coi như hết hạn", () => {
    expect(isTokenExpired(null, NOW)).toBe(true);
    expect(isTokenExpired("rac", NOW)).toBe(true);
  });

  it("exp tính bằng GIÂY chứ không phải mili-giây", () => {
    // Nhầm đơn vị là lỗi kinh điển: hiểu giây thành ms sẽ khiến token còn hạn
    // bị coi là hết từ 1970, đá người dùng ra ngay lập tức.
    const token = makeToken({ exp: inSeconds(3600) });
    expect(isTokenExpired(token, NOW)).toBe(false);
    expect(isTokenExpired(token, NOW + 3_600_000)).toBe(true);
  });

  it("isTokenValid là phủ định của isTokenExpired", () => {
    const alive = makeToken({ exp: inSeconds(3600) });
    const dead = makeToken({ exp: inSeconds(-10) });
    expect(isTokenValid(alive, NOW)).toBe(true);
    expect(isTokenValid(dead, NOW)).toBe(false);
  });
});

describe("resolveSessionState — flow đã thống nhất", () => {
  const alive = makeToken({ exp: inSeconds(3600) });
  const dead = makeToken({ exp: inSeconds(-10) });

  it("access còn hạn -> vào thẳng, khỏi gọi mạng", () => {
    expect(resolveSessionState(alive, alive, NOW)).toBe("active");
  });

  it("access chết, refresh còn -> gia hạn ngầm", () => {
    expect(resolveSessionState(dead, alive, NOW)).toBe("refreshable");
  });

  it("cả hai đều chết -> bắt đăng nhập lại", () => {
    // Đây chính là tình huống 'lâu lắm mới quay lại': trước đây app vẫn cho
    // vào vì token là chuỗi khác rỗng.
    expect(resolveSessionState(dead, dead, NOW)).toBe("expired");
  });

  it("chưa từng đăng nhập -> expired", () => {
    expect(resolveSessionState(null, null, NOW)).toBe("expired");
  });

  it("access còn hạn nhưng refresh đã chết -> vẫn dùng được nốt", () => {
    // Đá ra ngay lúc này là cắt ngang công việc dở dang một cách vô cớ.
    expect(resolveSessionState(alive, dead, NOW)).toBe("active");
  });
});
