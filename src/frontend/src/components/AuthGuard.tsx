"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
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
    }
  }, [isAuthenticated, isLoading, isLoginRoute, router]);

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Loading session…</p>
      </div>
    );
  }

  if (!isAuthenticated && !isLoginRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to login…</p>
      </div>
    );
  }

  if (isAuthenticated && isLoginRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
};
