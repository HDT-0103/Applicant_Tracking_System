"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  api,
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setSessionExpiredHandler,
  setStoredTokens,
} from "../services/httpClient";
import { resolveSessionState } from "../lib/jwt";
import {
  landingPathForRole,
  normaliseRole,
  type SelfSignupRole,
  type UserRole,
} from "../lib/rbac";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

// Định nghĩa role sống ở lib/rbac.ts. Re-export để import cũ vẫn chạy.
export { landingPathForRole, type SelfSignupRole, type UserRole };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  picture?: string;
}

interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  registerWithEmailPassword: (
    name: string,
    email: string,
    password: string,
    role: SelfSignupRole,
  ) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canUpload: boolean;
}

const USER_STORAGE_KEY = "smartats_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as AuthUser;
    // Session lưu trước khi hợp nhất role còn mang 'recruiter'/'interviewer'.
    const role = normaliseRole(stored.role);
    if (!role) return null; // role lạ -> coi như chưa đăng nhập
    return { ...stored, role };
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser | null): void {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Khôi phục phiên khi app khởi động.
    //
    // Trước đây chỉ kiểm tra token CÓ TỒN TẠI hay không:
    //
    //     if (storedUser && accessToken) setUser(storedUser);
    //
    // Một token chết từ nhiều tháng trước vẫn là chuỗi khác rỗng, nên app cho
    // vào thẳng rồi mọi lời gọi API đều hỏng — người dùng thấy mình đã đăng
    // nhập mà không mở được gì, và không hiểu vì sao.
    if (typeof window === "undefined") return;

    const storedUser = readStoredUser();
    const state = resolveSessionState(
      getStoredAccessToken(),
      getStoredRefreshToken(),
    );

    if (storedUser && state !== "expired") {
      // "refreshable": access đã chết nhưng refresh còn. Vào bình thường —
      // lượt gọi API đầu tiên sẽ tự gia hạn, người dùng không thấy gì cả.
      setUser(storedUser);
    } else if (state === "expired") {
      // Dọn sạch tàn dư để lần sau không rơi lại vào trạng thái nửa vời.
      clearStoredTokens();
      persistUser(null);
      setUser(null);
    }

    setIsLoading(false);
  }, []);

  // `httpClient` không phải component nên không tự chuyển trang được. Nó gọi
  // ngược lên đây khi refresh hỏng, để dọn `user` và đưa về màn hình đăng nhập.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      persistUser(null);
      setUser(null);
      router.replace("/login?reason=session_expired");
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const data = await api.post<GoogleAuthResponse>(
        "/api/auth/google",
        { credential },
        { skipAuth: true },
      );

      setStoredTokens(data.accessToken, data.refreshToken);
      persistUser(data.user);
      setUser(data.user);
      router.replace(landingPathForRole(data.user.role));
    },
    [router],
  );

  const loginWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<GoogleAuthResponse>(
        "/api/auth/login",
        { email, password },
        { skipAuth: true },
      );

      setStoredTokens(data.accessToken, data.refreshToken);
      persistUser(data.user);
      setUser(data.user);
      router.replace(landingPathForRole(data.user.role));
    },
    [router],
  );

  const registerWithEmailPassword = useCallback(
    async (name: string, email: string, password: string, role: SelfSignupRole) => {
      // Người đăng ký chọn giữa `hr` và `tech_lead`. Backend KHÔNG tin giá trị
      // này một cách mù quáng: `RegisterRequest.role` là Literal hai giá trị,
      // nên "admin" gửi lên bị trả 422 — kiểu ở đây chỉ để giao diện không gửi
      // nhầm, không phải là chốt chặn bảo mật.
      const data = await api.post<GoogleAuthResponse>(
        "/api/auth/register",
        { name, email, password, role },
        { skipAuth: true },
      );

      setStoredTokens(data.accessToken, data.refreshToken);
      persistUser(data.user);
      setUser(data.user);
      router.replace(landingPathForRole(data.user.role));
    },
    [router],
  );

  const logout = useCallback(() => {
    clearStoredTokens();
    persistUser(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  // hr và tech_lead dùng chung mọi chức năng; admin không tham gia nghiệp vụ.
  const canUpload = useMemo(
    () => hasRole("hr", "tech_lead"),
    [hasRole],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      loginWithGoogle,
      loginWithEmailPassword,
      registerWithEmailPassword,
      logout,
      hasRole,
      canUpload,
    }),
    [user, isLoading, loginWithGoogle, loginWithEmailPassword, registerWithEmailPassword, logout, hasRole, canUpload],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

/* ------------------------------------------------------------------ */
/*  Hook                                                                */
/* ------------------------------------------------------------------ */

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
};
