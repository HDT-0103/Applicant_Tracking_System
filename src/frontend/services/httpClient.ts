import { isTokenExpired } from "../lib/jwt";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const ACCESS_TOKEN_KEY = "smartats_access_token";
const REFRESH_TOKEN_KEY = "smartats_refresh_token";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(
  accessToken: string,
  refreshToken: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  skipAuth?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // Refresh hỏng nghĩa là phiên chết hẳn. Không chỉ xoá token mà còn phải
    // báo cho AuthContext, nếu không giao diện vẫn tưởng đang đăng nhập.
    notifySessionExpired();
    return null;
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken?: string;
  };

  setStoredTokens(data.accessToken, data.refreshToken ?? refreshToken);
  return data.accessToken;
}

/**
 * Gia hạn token, gộp các lời gọi trùng nhau.
 *
 * Một trang thường bắn nhiều request cùng lúc. Không gộp thì mỗi request hỏng
 * lại gọi /refresh một lần; backend cấp refresh token MỚI mỗi lần và vô hiệu
 * cái cũ, nên các lời gọi sau sẽ dùng phải token vừa bị thu hồi và đăng xuất
 * oan người dùng.
 */
function refreshAccessTokenOnce(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// `smartats_demo_role` (role giả lưu trong localStorage) đã được gỡ: role chỉ
// đến từ JWT do backend cấp. Client tự đặt role không phải là phân quyền.

/**
 * Lỗi mang theo mã HTTP, để chỗ gọi phân biệt được hai chuyện hoàn toàn khác nhau:
 *
 *   401 — chưa xác thực / phiên đã chết  -> đăng nhập lại là xong
 *   403 — đã xác thực nhưng KHÔNG ĐỦ QUYỀN -> đăng nhập lại cũng vô ích
 *
 * Trước đây cả hai đều ném ra `Error` chung, nên giao diện không thể phân biệt.
 * Đá người dùng về trang đăng nhập khi gặp 403 sẽ tạo vòng lặp: đăng nhập lại,
 * vẫn 403, lại đá ra — mà nguyên nhân thật chỉ là role không được phép.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Phiên chết — cần đăng nhập lại. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Đăng nhập rồi nhưng role không được phép — đăng nhập lại KHÔNG giúp gì. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/**
 * Đăng ký hàm được gọi khi phiên chết hẳn (refresh cũng hỏng).
 *
 * `httpClient` không phải component React nên không tự chuyển trang được.
 * `AuthContext` đăng ký vào đây để dọn `user` và đưa về `/login`. Thiếu móc
 * nối này thì token bị xoá nhưng giao diện vẫn hiện "đã đăng nhập" — trạng
 * thái xác sống mà người dùng chỉ thoát được bằng cách xoá cache thủ công.
 */
type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

/**
 * Ends the session everywhere: clears tokens and lets AuthContext redirect.
 *
 * Exported because `lib/db` (the direct-PostgREST path) must end a session the
 * same way this module does. Two different sign-out routines would drift, and
 * one of them would eventually forget to clear something.
 */
export function notifySessionExpired(): void {
  clearStoredTokens();
  sessionExpiredHandler?.();
}

/**
 * Lấy access token dùng được, tự gia hạn nếu đã hết hạn.
 *
 * Kiểm hạn NGAY TẠI ĐÂY thay vì gửi đi rồi chờ 401: token đã chết thì lượt gọi
 * đó chắc chắn hỏng, nên tiết kiệm được một vòng khứ hồi. Quan trọng hơn, với
 * WebSocket thì không có "thử lại sau 401" — sai token là bị đóng kết nối.
 */
async function getValidAccessToken(): Promise<string | null> {
  const accessToken = getStoredAccessToken();
  if (accessToken && !isTokenExpired(accessToken)) return accessToken;

  // Access chết. Còn refresh dùng được thì gia hạn ngầm.
  const refreshToken = getStoredRefreshToken();
  if (refreshToken && !isTokenExpired(refreshToken)) {
    return refreshAccessTokenOnce();
  }

  // Cả hai đều chết: chỉ báo hết phiên khi TỪNG có token. Người chưa đăng nhập
  // bao giờ mà bị đá về /login thì đó là phiền nhiễu vô cớ.
  if (accessToken || refreshToken) notifySessionExpired();
  return null;
}

export async function streamClient(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const accessToken = await getValidAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    const newToken = await refreshAccessTokenOnce();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    }
    if (response.status === 401) notifySessionExpired();
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string; message?: string };
      message = body.detail ?? body.message ?? message;
    } catch {
      /* Keep the HTTP status when a stream endpoint has no JSON error body. */
    }
    throw new ApiError(message, response.status);
  }
  if (!response.body) throw new Error("Agent response did not include a stream");
  return response;
}

function buildHeaders(
  initHeaders: HeadersInit | undefined,
  accessToken: string | null,
  skipAuth: boolean,
  isFormData: boolean,
): Headers {
  const headers = new Headers(initHeaders);

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

export async function httpClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipAuth = false, body, headers, ...rest } = options;
  const isFormData = body instanceof FormData;

  const accessToken = skipAuth ? null : await getValidAccessToken();

  const requestBody =
    body == null || isFormData
      ? (body as BodyInit | null | undefined)
      : JSON.stringify(body);

  const execute = (token: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: buildHeaders(headers, token, skipAuth, isFormData),
      body: requestBody,
    });

  let response = await execute(accessToken);

  if (response.status === 401 && !skipAuth) {
    // Server từ chối token dù client tưởng còn hạn — ví dụ admin đã thu hồi
    // phiên, hoặc đồng hồ hai bên lệch. Thử gia hạn đúng một lần.
    const newToken = await refreshAccessTokenOnce();
    if (newToken) {
      response = await execute(newToken);
    }
    // Vẫn 401 sau khi gia hạn: phiên chết hẳn.
    if (response.status === 401) notifySessionExpired();
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorBody = (await response.json()) as { detail?: string; message?: string };
      message = errorBody.detail ?? errorBody.message ?? message;
    } catch {
      /* ignore parse errors */
    }
    // Ném ApiError chứ không phải Error trần: giao diện cần phân biệt được
    // "hết phiên" (401, đăng nhập lại) với "không đủ quyền" (403, đăng nhập
    // lại cũng vô ích).
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    httpClient<T>(path, { ...options, method: "GET" }),

  post: <T>(
    path: string,
    body?: RequestOptions["body"],
    options?: RequestOptions,
  ) => httpClient<T>(path, { ...options, method: "POST", body }),

  put: <T>(
    path: string,
    body?: RequestOptions["body"],
    options?: RequestOptions,
  ) => httpClient<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(
    path: string,
    body?: RequestOptions["body"],
    options?: RequestOptions,
  ) => httpClient<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    httpClient<T>(path, { ...options, method: "DELETE" }),
};
