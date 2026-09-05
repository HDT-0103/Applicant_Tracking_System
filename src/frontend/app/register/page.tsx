"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Mail, KeyRound, Loader2, ArrowRight, Building2, Globe } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { SELF_SIGNUP_ROLES, type SelfSignupRole } from "../../lib/rbac";
import { useT } from "../../lib/i18n";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { T } from "../../components/auth/authTheme";
import { submitStyle } from "../../components/Login";

export default function RegisterPage() {
  const { registerWithEmailPassword } = useAuth();
  const t = useT();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Mặc định `hr` — cũng là mặc định của backend khi thiếu trường này, nên hai
  // bên không lệch nhau nếu ai đó gọi API thẳng.
  const [role, setRole] = useState<SelfSignupRole>("hr");
  // Công ty là bắt buộc (V009): tài khoản nội bộ phải thuộc về một công ty và
  // tên đó hiện ở header cùng trang tin tuyển dụng. Website thì tuỳ chọn.
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !companyName.trim()) {
      setError(t("auth.register.fillRequired"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await registerWithEmailPassword(name, email, password, role, {
        company_name: companyName.trim(),
        company_website: companyWebsite.trim() || null,
      });
      // Redirect is handled in AuthContext (recruiters land on the workspace).
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.register.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      heading={t("auth.register.heading")}
      subheading={t("auth.register.subheading")}
      error={error}
      footer={
        <>
          {t("auth.register.haveAccount")}{" "}
          <Link href="/login" style={{ color: T.primary, fontWeight: 600, textDecoration: "none" }}>
            {t("auth.register.signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AuthField
          id="name"
          label={t("auth.register.fullName")}
          value={name}
          onChange={setName}
          placeholder={t("auth.register.fullNamePlaceholder")}
          icon={User}
          autoComplete="name"
        />
        <AuthField
          id="email"
          label={t("auth.register.workEmail")}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t("auth.register.workEmailPlaceholder")}
          icon={Mail}
          autoComplete="email"
        />
        <AuthField
          id="password"
          label={t("auth.register.password")}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={t("auth.register.passwordPlaceholder")}
          icon={KeyRound}
          autoComplete="new-password"
        />
        <AuthField
          id="company-name"
          label={t("auth.register.companyName")}
          value={companyName}
          onChange={setCompanyName}
          placeholder={t("auth.register.companyNamePlaceholder")}
          icon={Building2}
          autoComplete="organization"
        />
        <AuthField
          id="company-website"
          label={t("auth.register.companyWebsite")}
          type="url"
          value={companyWebsite}
          onChange={setCompanyWebsite}
          placeholder={t("auth.register.companyWebsitePlaceholder")}
          icon={Globe}
          autoComplete="url"
          required={false}
        />

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.sub,
              marginBottom: 6,
              padding: 0,
            }}
          >
            {t("auth.register.joiningAs")}
          </legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SELF_SIGNUP_ROLES.map((option) => {
              const selected = role === option;
              return (
                <label
                  key={option}
                  htmlFor={`role-${option}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${selected ? T.primary : T.line}`,
                    borderRadius: T.radius,
                    background: T.page,
                    boxShadow: selected ? `0 0 0 3px ${T.ring}` : "none",
                    cursor: "pointer",
                    transition: "border-color .15s ease, box-shadow .15s ease",
                  }}
                >
                  <input
                    id={`role-${option}`}
                    type="radio"
                    name="role"
                    value={option}
                    checked={selected}
                    onChange={() => setRole(option)}
                    style={{ marginTop: 3, accentColor: T.primary }}
                  />
                  <span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 600,
                        color: T.ink,
                      }}
                    >
                      {t(`role.${option}`)}
                    </span>
                    <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                      {t(`role.hint.${option}`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button type="submit" disabled={isSubmitting} style={submitStyle(isSubmitting)}>
          {isSubmitting ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              <span>{t("auth.register.submitting")}</span>
            </>
          ) : (
            <>
              <span>{t("auth.register.submit")}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <p style={{ fontSize: 12, color: T.dim, textAlign: "center", margin: "2px 0 0", lineHeight: 1.5 }}>
          {t("auth.register.adminNote")}
        </p>
      </form>
    </AuthShell>
  );
}
