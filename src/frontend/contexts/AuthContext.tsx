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
  setStoredTokens,
} from "../services/httpClient";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type UserRole = "recruiter" | "interviewer" | "admin";

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
    return JSON.parse(raw) as AuthUser;
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

// Demo user for testing without Google OAuth
const DEMO_USER: AuthUser = {
  id: "demo-12345",
  email: "demo@smartats.com",
  name: "Demo Recruiter",
  role: "recruiter",
  picture: "https://ui-avatars.com/api/?name=Demo+Recruiter&background=0d6efd&color=fff&size=128"
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(DEMO_USER); // Set immediately for SSR!
  const [isLoading, setIsLoading] = useState(false); // No loading for demo mode!
  const router = useRouter();

  useEffect(() => {
    // Auto-login as demo recruiter for testing!
    if (typeof window !== "undefined") {
      persistUser(DEMO_USER);
      setStoredTokens("dummy-access-token", "dummy-refresh-token");
    }
  }, []);

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
      router.replace("/");
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

  const canUpload = useMemo(
    () => hasRole("recruiter", "admin"),
    [hasRole],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      loginWithGoogle,
      logout,
      hasRole,
      canUpload,
    }),
    [user, isLoading, loginWithGoogle, logout, hasRole, canUpload],
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
