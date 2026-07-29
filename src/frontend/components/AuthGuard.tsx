"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, landingPathForRole } from "../contexts/AuthContext";
import { isAuthRoute, isPublicRoute } from "../lib/routes";

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

  const publicRoute = isPublicRoute(pathname);
  const authRoute = isAuthRoute(pathname);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !publicRoute) {
      router.replace("/login");
      return;
    }

    // Only the sign-in screens bounce a logged-in user away — an HR previewing
    // the public career page should stay on it.
    if (isAuthenticated && authRoute) {
      router.replace(landingPathForRole(user?.role));
    }
  }, [isAuthenticated, isLoading, publicRoute, authRoute, router, user]);
 
  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Loading session&hellip;</p>
      </div>
    );
  }
 
  if (!isAuthenticated && !publicRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to login&hellip;</p>
      </div>
    );
  }

  if (isAuthenticated && authRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to workspace&hellip;</p>
      </div>
    );
  }

  return <>{children}</>;
};
