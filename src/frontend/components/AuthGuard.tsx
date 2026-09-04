"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  COMPANY_ONBOARDING_PATH,
  needsCompanyOnboarding,
  useAuth,
} from "../contexts/AuthContext";
import { ADMIN_HOME, isAdminAllowedPath, landingPathForRole } from "../lib/rbac";
import { isAuthRoute, isPublicRoute } from "../lib/routes";
import { useT } from "../lib/i18n";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const t = useT();
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

  // Chưa khai công ty thì chưa vào workspace. Người đăng nhập Google lần đầu
  // không có chỗ nào khác để được hỏi — Google chỉ trả tên và email.
  const onboardingPending =
    isAuthenticated &&
    needsCompanyOnboarding(user) &&
    !publicRoute &&
    pathname !== COMPANY_ONBOARDING_PATH;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !publicRoute) {
      router.replace("/login");
      return;
    }

    // Only the sign-in screens bounce a logged-in user away — an HR previewing
    // the public career page should stay on it.
    if (isAuthenticated && authRoute) {
      router.replace(
        needsCompanyOnboarding(user) ? COMPANY_ONBOARDING_PATH : landingPathForRole(user?.role),
      );
      return;
    }

    if (adminOutsidePanel) {
      router.replace(ADMIN_HOME);
      return;
    }

    if (onboardingPending) {
      router.replace(COMPANY_ONBOARDING_PATH);
    }
  }, [
    isAuthenticated,
    isLoading,
    publicRoute,
    authRoute,
    adminOutsidePanel,
    onboardingPending,
    router,
    user,
  ]);

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>{t("guard.loadingSession")}</p>
      </div>
    );
  }

  if (!isAuthenticated && !publicRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>{t("guard.redirectLogin")}</p>
      </div>
    );
  }

  if (isAuthenticated && authRoute) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>{t("guard.redirectWorkspace")}</p>
      </div>
    );
  }

  if (adminOutsidePanel) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>{t("guard.redirectAdmin")}</p>
      </div>
    );
  }

  if (onboardingPending) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p>{t("guard.completingProfile")}</p>
      </div>
    );
  }

  return <>{children}</>;
};
