"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

const ROLE_ROUTE_MAP: Array<{ pattern: RegExp; allowed: string[] }> = [
  { pattern: /^\/schedule/, allowed: ["hr"] },
];

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isLoginRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isLoginRoute) {
      router.replace("/");
      return;
    }

    if (isAuthenticated && user) {
      for (const entry of ROLE_ROUTE_MAP) {
        if (entry.pattern.test(pathname)) {
          if (!entry.allowed.includes(user.role)) {
            router.replace("/");
            return;
          }
          break;
        }
      }
    }
  }, [isAuthenticated, isLoading, isLoginRoute, router, pathname, user]);

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Loading session&hellip;</p>
      </div>
    );
  }

  if (!isAuthenticated && !isLoginRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to login&hellip;</p>
      </div>
    );
  }

  if (isAuthenticated && isLoginRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to workspace&hellip;</p>
      </div>
    );
  }

  return <>{children}</>;
};
