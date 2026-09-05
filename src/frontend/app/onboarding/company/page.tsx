"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Loader2, ArrowRight } from "lucide-react";
import { useAuth, landingPathForRole } from "../../../contexts/AuthContext";
import { AuthShell } from "../../../components/auth/AuthShell";
import { AuthField } from "../../../components/auth/AuthField";
import { T } from "../../../components/auth/authTheme";
import { submitStyle } from "../../../components/Login";
import { useT } from "../../../lib/i18n";

/**
 * Hoàn tất hồ sơ: công ty của người dùng.
 *
 * Người đăng ký bằng email khai công ty ngay ở màn hình đăng ký. Người vào
 * bằng Google lần đầu thì không có chỗ nào để hỏi — Google chỉ trả tên và
 * email — nên `AuthGuard` đưa họ tới đây trước khi vào app. Ai đã có công ty
 * vẫn mở được trang này để sửa.
 */
export default function CompanyOnboardingPage() {
  const { user, updateCompany } = useAuth();
  const router = useRouter();
  const t = useT();

  const [companyName, setCompanyName] = useState(user?.company_name ?? "");
  const [companyWebsite, setCompanyWebsite] = useState(user?.company_website ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError(t("onboarding.required"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await updateCompany({
        company_name: companyName.trim(),
        company_website: companyWebsite.trim() || null,
      });
      router.replace(landingPathForRole(user?.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.couldNotSave"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      heading={t("onboarding.title")}
      subheading={user?.name ? t("onboarding.welcome", { name: user.name }) : t("onboarding.subtitle")}
      error={error}
      footer={
        <span style={{ color: T.dim }}>{t("onboarding.footer")}</span>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AuthField
          id="company-name"
          label={t("settings.companyName")}
          value={companyName}
          onChange={setCompanyName}
          placeholder="Acme Corp"
          icon={Building2}
          autoComplete="organization"
        />
        <AuthField
          id="company-website"
          label={t("settings.companyWebsite")}
          type="url"
          value={companyWebsite}
          onChange={setCompanyWebsite}
          placeholder="https://acme.example"
          icon={Globe}
          autoComplete="url"
          required={false}
        />

        <button type="submit" disabled={isSubmitting} style={submitStyle(isSubmitting)}>
          {isSubmitting ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              <span>{t("common.saving")}</span>
            </>
          ) : (
            <>
              <span>{t("common.continue")}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
