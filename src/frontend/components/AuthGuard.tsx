"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, landingPathForRole } from "../contexts/AuthContext";

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

  const isPublicRoute = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isPublicRoute) {
      router.replace(landingPathForRole(user?.role));
    }
  }, [isAuthenticated, isLoading, isPublicRoute, router, user]);
 
  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Loading session&hellip;</p>
      </div>
    );
  }
 
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to login&hellip;</p>
      </div>
    );
  }
 
  if (isAuthenticated && isPublicRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to workspace&hellip;</p>
      </div>
    );
  }

  return <>{children}</>;
};
