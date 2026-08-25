/**
 * Đọc hạn dùng của JWT ở phía client.
 *
 * KHÔNG phải kiểm tra bảo mật. Chữ ký chỉ backend mới xác thực được, và điều
 * đó không đổi: mọi endpoint vẫn tự kiểm token của mình. Ở đây chỉ trả lời một
 * câu hỏi về trải nghiệm — "token này còn dùng được không, hay khỏi cần gửi
 * đi cho mất công?".
 *
 * Có nó vì trước đây `AuthContext` khôi phục phiên bằng cách kiểm tra token
 * CÓ TỒN TẠI hay không, chứ không kiểm còn hạn. Một token chết từ nhiều tháng
 * trước vẫn là chuỗi khác rỗng, nên app cho vào thẳng rồi mọi lời gọi API đều
 * hỏng — người dùng thấy mình đã đăng nhập mà không làm được gì.
 */

/** Payload phần giữa của JWT. Chỉ khai những trường thực sự dùng tới. */
export interface JwtPayload {
  /** Thời điểm hết hạn, tính bằng GIÂY kể từ epoch (chuẩn JWT, không phải ms). */
  exp?: number;
  sub?: string;
  email?: string;
  role?: string;
  type?: string;
  jti?: string;
}

/** Giải base64url — khác base64 thường ở hai ký tự và phần đệm bị lược. */
function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const binary = atob(padded);
    // Đi qua UTF-8 để tên tiếng Việt trong token không bị vỡ.
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Lấy payload của JWT. Trả `null` với mọi thứ không phải JWT hợp lệ.
 *
 * Không bao giờ ném lỗi: hàm này chạy lúc khởi động app, mà `localStorage` thì
 * có thể chứa bất cứ thứ gì — token cắt dở, dữ liệu từ phiên bản cũ, hay chuỗi
 * do người dùng tự sửa.
 */
export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const json = decodeBase64Url(parts[1]);
  if (json === null) return null;

  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as JwtPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Số giây phòng hờ trước khi coi token là hết hạn.
 *
 * Đồng hồ máy người dùng và đồng hồ máy chủ hiếm khi khớp tuyệt đối. Không trừ
 * hao thì sẽ có trường hợp client tưởng token còn 2 giây, gửi đi, và server
 * bảo đã hết — đúng loại lỗi chập chờn rất khó tái hiện.
 */
const CLOCK_SKEW_SECONDS = 30;

/**
 * Token đã hết hạn (hoặc sắp, trong khoảng phòng hờ) hay chưa.
 *
 * Token không đọc được coi như đã hết hạn — an toàn hơn là cho qua rồi để
 * người dùng rơi vào trạng thái nửa vời.
 *
 * Token KHÔNG có `exp` cũng coi như hết hạn: hệ này luôn phát token có hạn,
 * nên thiếu `exp` nghĩa là dữ liệu hỏng chứ không phải "sống mãi".
 */
export function isTokenExpired(
  token: string | null | undefined,
  nowMs: number = Date.now(),
  skewSeconds: number = CLOCK_SKEW_SECONDS,
): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 <= nowMs + skewSeconds * 1000;
}

/** Ngược lại của `isTokenExpired`, để chỗ gọi đọc xuôi hơn. */
export function isTokenValid(
  token: string | null | undefined,
  nowMs?: number,
): boolean {
  return !isTokenExpired(token, nowMs);
}

/** Trạng thái phiên suy ra từ cặp token đang lưu. */
export type SessionState =
  /** Access còn hạn — vào thẳng, không cần gọi mạng. */
  | "active"
  /** Access hết hạn nhưng refresh còn — làm mới ngầm, người dùng không thấy gì. */
  | "refreshable"
  /** Cả hai đều chết hoặc không có — phải đăng nhập lại. */
  | "expired";

/**
 * Quyết định phải làm gì với cặp token đang lưu, lúc app khởi động.
 *
 * Đây chính là flow đã thống nhất: còn hạn thì dùng tiếp, hết access mà còn
 * refresh thì gia hạn ngầm, chết cả hai thì bắt đăng nhập lại.
 */
export function resolveSessionState(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined,
  nowMs?: number,
): SessionState {
  if (isTokenValid(accessToken, nowMs)) return "active";
  if (isTokenValid(refreshToken, nowMs)) return "refreshable";
  return "expired";
}
