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
  setStoredDemoRole,
  setStoredTokens,
} from "../services/httpClient";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type UserRole = "recruiter" | "interviewer" | "admin" | "tech_lead" | "hr";

/** Post-auth landing route: admins go straight to the Admin Panel. */
export function landingPathForRole(role?: UserRole): string {
  return role === "admin" ? "/admin" : "/";
}

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
  registerWithEmailPassword: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canUpload: boolean;
  devSetRole: (role: UserRole) => void;
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
  role: "hr",
  picture: "https://ui-avatars.com/api/?name=Demo+Recruiter&background=0d6efd&color=fff&size=128"
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore user session from localStorage on mount
    if (typeof window !== "undefined") {
      const storedUser = readStoredUser();
      const accessToken = getStoredAccessToken();
      
      if (storedUser && accessToken) {
        setUser(storedUser);
      }
      setIsLoading(false);
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
    async (name: string, email: string, password: string) => {
      // Role is assigned server-side (recruiter); never sent from the client.
      const data = await api.post<GoogleAuthResponse>(
        "/api/auth/register",
        { name, email, password },
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

  const canUpload = useMemo(
    () => hasRole("hr", "admin"),
    [hasRole],
  );

  const devSetRole = useCallback((role: UserRole) => {
    setUser((prev) => (prev && prev.id === "demo-12345" ? { ...prev, role } : prev));
    setStoredDemoRole(role);
  }, []);

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
      devSetRole,
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
