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
import { clearQueryCache } from "../lib/queryCache";
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
  /** Công ty của người dùng (V009). `null`/thiếu = chưa hoàn tất hồ sơ. */
  company_name?: string | null;
  company_website?: string | null;
  /** Tài khoản đăng ký bằng email (có mật khẩu) hay chỉ Google. */
  has_password?: boolean;
}

export interface CompanyProfile {
  company_name: string;
  company_website?: string | null;
}

/** Ba trường người dùng tự sửa được ở Settings. `undefined` = giữ nguyên. */
export interface ProfileUpdate {
  name?: string;
  company_name?: string;
  company_website?: string | null;
}

/** Màn hình bắt điền công ty; xem `needsCompanyOnboarding`. */
export const COMPANY_ONBOARDING_PATH = "/onboarding/company";

/**
 * Ai còn phải khai công ty. Admin thì không: họ quản trị hệ thống, không đại
 * diện cho công ty nào.
 */
export function needsCompanyOnboarding(user: AuthUser | null | undefined): boolean {
  if (!user || user.role === "admin") return false;
  return !(user.company_name && user.company_name.trim());
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
    company: CompanyProfile,
  ) => Promise<void>;
  /** Hoàn tất / sửa công ty của chính mình (PATCH /api/auth/me). */
  updateCompany: (company: CompanyProfile) => Promise<void>;
  /** Sửa tên / công ty / website ở Settings (PATCH /api/auth/me). */
  updateProfile: (fields: ProfileUpdate) => Promise<void>;
  /** Đổi mật khẩu; backend đòi mật khẩu hiện tại và từ chối tài khoản Google. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
      // Làm mới hồ sơ từ DB. Token không mang công ty, và bản trong
      // localStorage là ảnh chụp lúc đăng nhập — người vừa khai công ty ở
      // tab khác, hay admin vừa sửa, phải được thấy ở đây mà không cần đăng
      // nhập lại. Hỏng thì giữ bản cũ: đây là tiện nghi, không phải cổng.
      api
        .get<AuthUser>("/api/auth/me")
        .then((fresh) => {
          const role = normaliseRole(fresh.role);
          if (!role) return;
          const merged = { ...storedUser, ...fresh, role };
          persistUser(merged);
          setUser(merged);
        })
        .catch(() => undefined);
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
      clearQueryCache();
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
    async (
      name: string,
      email: string,
      password: string,
      role: SelfSignupRole,
      company: CompanyProfile,
    ) => {
      // Người đăng ký chọn giữa `hr` và `tech_lead`. Backend KHÔNG tin giá trị
      // này một cách mù quáng: `RegisterRequest.role` là Literal hai giá trị,
      // nên "admin" gửi lên bị trả 422 — kiểu ở đây chỉ để giao diện không gửi
      // nhầm, không phải là chốt chặn bảo mật.
      const data = await api.post<GoogleAuthResponse>(
        "/api/auth/register",
        {
          name,
          email,
          password,
          role,
          company_name: company.company_name,
          company_website: company.company_website || null,
        },
        { skipAuth: true },
      );

      setStoredTokens(data.accessToken, data.refreshToken);
      persistUser(data.user);
      setUser(data.user);
      router.replace(landingPathForRole(data.user.role));
    },
    [router],
  );

  const updateProfile = useCallback(async (fields: ProfileUpdate) => {
    const body: Record<string, unknown> = {};
    if (fields.name !== undefined) body.name = fields.name;
    if (fields.company_name !== undefined) body.company_name = fields.company_name;
    // Website: chuỗi rỗng = xoá. Backend hiểu "" là NULL; `null` bị pydantic
    // coi là "không gửi" nên phải gửi "" mới xoá được.
    if (fields.company_website !== undefined) body.company_website = fields.company_website ?? "";
    const fresh = await api.patch<AuthUser>("/api/auth/me", body);
    setUser((current) => {
      const merged = { ...(current ?? fresh), ...fresh, role: current?.role ?? fresh.role };
      persistUser(merged);
      return merged;
    });
  }, []);

  const updateCompany = useCallback(
    (company: CompanyProfile) =>
      updateProfile({
        company_name: company.company_name,
        company_website: company.company_website ?? "",
      }),
    [updateProfile],
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }, []);

  const logout = useCallback(() => {
    clearStoredTokens();
    persistUser(null);
    setUser(null);
    // Cache danh sách là của phiên vừa đăng xuất; người tiếp theo đăng nhập
    // trên cùng tab không được thấy sidebar của người trước.
    clearQueryCache();
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
      updateCompany,
      updateProfile,
      changePassword,
      logout,
      hasRole,
      canUpload,
    }),
    [user, isLoading, loginWithGoogle, loginWithEmailPassword, registerWithEmailPassword, updateCompany, updateProfile, changePassword, logout, hasRole, canUpload],
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
