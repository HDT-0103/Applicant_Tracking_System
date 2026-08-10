"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { ADMIN_HOME, isAdminAllowedPath, landingPathForRole } from "../lib/rbac";
import { isAuthRoute, isPublicRoute } from "../lib/routes";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const publicRoute = isPublicRoute(pathname);
  const authRoute = isAuthRoute(pathname);

  // Admin chỉ quản trị hệ thống: mọi màn hình nghiệp vụ đều đẩy về /admin.
  // hr và tech_lead dùng chung toàn bộ route — khác biệt giữa hai role nằm ở
  // dữ liệu backend trả về (ABAC), không nằm ở đây.
  const adminOutsidePanel =
    isAuthenticated &&
    user?.role === "admin" &&
    !publicRoute &&
    !isAdminAllowedPath(pathname);

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
      return;
    }

    if (adminOutsidePanel) {
      router.replace(ADMIN_HOME);
    }
  }, [
    isAuthenticated,
    isLoading,
    publicRoute,
    authRoute,
    adminOutsidePanel,
    router,
    user,
  ]);

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

  if (adminOutsidePanel) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>Redirecting to Admin Panel&hellip;</p>
      </div>
    );
  }

  return <>{children}</>;
};
