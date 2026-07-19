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
    clearStoredTokens();
    return null;
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken?: string;
  };

  setStoredTokens(data.accessToken, data.refreshToken ?? refreshToken);
  return data.accessToken;
}

const DEMO_ROLE_KEY = "smartats_demo_role";

export function getStoredDemoRole(): string {
  if (typeof window === "undefined") return "hr";
  return localStorage.getItem(DEMO_ROLE_KEY) ?? "hr";
}

export function setStoredDemoRole(role: string): void {
  localStorage.setItem(DEMO_ROLE_KEY, role);
}

async function getValidAccessToken(): Promise<string | null> {
  const accessToken = getStoredAccessToken();
  if (accessToken) return accessToken;
  return null;
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
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await execute(newToken);
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorBody = (await response.json()) as { detail?: string; message?: string };
      message = errorBody.detail ?? errorBody.message ?? message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
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

  delete: <T>(path: string, options?: RequestOptions) =>
    httpClient<T>(path, { ...options, method: "DELETE" }),
};
