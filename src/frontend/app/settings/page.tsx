"use client";

import React, { useState } from "react";
import { Building2, Globe, KeyRound, Loader2, Monitor, Moon, Sun, User } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme, type ThemePreference } from "../../contexts/ThemeContext";
import { D } from "../../lib/shared";
import { LANGS, useLang, useT } from "../../lib/i18n";
import { Languages } from "lucide-react";

/**
 * Settings: hồ sơ, giao diện, bảo mật.
 *
 * Email và role KHÔNG sửa được ở đây (việc của admin). Đổi mật khẩu chỉ hiện
 * với tài khoản đăng ký bằng email; tài khoản Google không có mật khẩu và
 * backend cũng từ chối tạo mới.
 */
export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { preference, setPreference } = useTheme();
  const { lang, setLang } = useLang();
  const t = useT();

  const [name, setName] = useState(user?.name ?? "");
  const [companyName, setCompanyName] = useState(user?.company_name ?? "");
  const [companyWebsite, setCompanyWebsite] = useState(user?.company_website ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (user?.role !== "admin" && !companyName.trim())) {
      setProfileNotice({ tone: "error", text: t("settings.profileRequired") });
      return;
    }
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      await updateProfile({
        name: name.trim(),
        company_name: companyName.trim() || undefined,
        company_website: companyWebsite.trim(),
      });
      setProfileNotice({ tone: "ok", text: t("settings.profileSaved") });
    } catch (err) {
      setProfileNotice({ tone: "error", text: err instanceof Error ? err.message : t("settings.couldNotSave") });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      setPwNotice({ tone: "error", text: t("settings.passwordTooShort") });
      return;
    }
    if (newPw !== confirmPw) {
      setPwNotice({ tone: "error", text: t("settings.passwordMismatch") });
      return;
    }
    setSavingPw(true);
    setPwNotice(null);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwNotice({ tone: "ok", text: t("settings.passwordChanged") });
    } catch (err) {
      setPwNotice({ tone: "error", text: err instanceof Error ? err.message : t("settings.couldNotChangePassword") });
    } finally {
      setSavingPw(false);
    }
  };

  const themes: { value: ThemePreference; label: string; Icon: typeof Sun; hint: string }[] = [
    { value: "light", label: t("common.theme.light"), Icon: Sun, hint: t("settings.theme.lightHint") },
    { value: "dark", label: t("common.theme.dark"), Icon: Moon, hint: t("settings.theme.darkHint") },
    { value: "system", label: t("common.theme.system"), Icon: Monitor, hint: t("settings.theme.systemHint") },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: D.ink, margin: "0 0 4px" }}>{t("settings.title")}</h1>
        <p style={{ fontSize: 13, color: D.muted, margin: "0 0 24px" }}>{t("settings.subtitle")}</p>

        {/* Profile */}
        <section style={card}>
          <SectionTitle icon={User} title={t("settings.profile")} subtitle={t("settings.profile.subtitle")} />
          <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field id="name" label={t("settings.fullName")} value={name} onChange={setName} icon={User} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <ReadOnly label={t("settings.email")} value={user?.email ?? ""} />
              <ReadOnly label={t("settings.role")} value={user?.role ? t(`role.${user.role}`) : ""} />
            </div>
            <Field id="company-name" label={t("settings.companyName")} value={companyName} onChange={setCompanyName} icon={Building2} />
            <Field id="company-website" label={t("settings.companyWebsite")} value={companyWebsite} onChange={setCompanyWebsite} icon={Globe} type="url" />
            <Notice notice={profileNotice} />
            <div>
              <button type="submit" disabled={savingProfile} style={primaryButton(savingProfile)}>
                {savingProfile ? <Loader2 size={14} className="animate-spin" /> : null}
                {t("settings.saveProfile")}
              </button>
            </div>
          </form>
        </section>

        {/* Appearance */}
        <section style={card}>
          <SectionTitle icon={Sun} title={t("settings.appearance")} subtitle={t("settings.appearance.subtitle")} />
          <div role="radiogroup" aria-label={t("common.theme")} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {themes.map(({ value, label, Icon, hint }) => {
              const active = preference === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreference(value)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
                    padding: "12px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    border: `1px solid ${active ? D.blue : D.line}`,
                    background: active ? D.blueSoft : D.canvas,
                    color: D.ink, fontFamily: D.font,
                  }}
                >
                  <Icon size={16} color={active ? D.blue : D.muted} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 11, color: D.muted }}>{hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Language */}
        <section style={card}>
          <SectionTitle icon={Languages} title={t("common.language")} subtitle={t("settings.language.subtitle")} />
          <div role="radiogroup" aria-label={t("common.language")} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {LANGS.map(({ value, label }) => {
              const active = lang === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLang(value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    border: `1px solid ${active ? D.blue : D.line}`,
                    background: active ? D.blueSoft : D.canvas,
                    color: D.ink, fontFamily: D.font, fontSize: 13, fontWeight: 600,
                  }}
                >
                  <Languages size={16} color={active ? D.blue : D.muted} /> {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Security */}
        <section style={card}>
          <SectionTitle icon={KeyRound} title={t("settings.security")} subtitle={t("settings.security.subtitle")} />
          {user?.has_password ? (
            <form onSubmit={savePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field id="current-password" label={t("settings.currentPassword")} value={currentPw} onChange={setCurrentPw} icon={KeyRound} type="password" autoComplete="current-password" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field id="new-password" label={t("settings.newPassword")} value={newPw} onChange={setNewPw} icon={KeyRound} type="password" autoComplete="new-password" />
                <Field id="confirm-password" label={t("settings.confirmPassword")} value={confirmPw} onChange={setConfirmPw} icon={KeyRound} type="password" autoComplete="new-password" />
              </div>
              <Notice notice={pwNotice} />
              <div>
                <button type="submit" disabled={savingPw} style={primaryButton(savingPw)}>
                  {savingPw ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("settings.changePassword")}
                </button>
              </div>
            </form>
          ) : (
            <p style={{ fontSize: 12.5, color: D.muted, margin: 0 }}>{t("settings.googleAccount")}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

const card: React.CSSProperties = {
  border: `1px solid ${D.line}`,
  borderRadius: 12,
  background: D.canvas,
  padding: 20,
  marginBottom: 18,
};

const primaryButton = (busy: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "8px 16px", borderRadius: 8, border: "none",
  background: D.blue, color: "#fff", fontSize: 13, fontWeight: 600,
  cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: D.font,
});

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof User; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={15} color={D.blue} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: D.ink, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12, color: D.muted, margin: "4px 0 0" }}>{subtitle}</p>
    </div>
  );
}

function Field({
  id, label, value, onChange, icon: Icon, type = "text", autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  icon: typeof User; type?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12, fontWeight: 600, color: D.sub, marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${D.line}`, borderRadius: 8, padding: "0 12px", background: D.canvas }}>
        <Icon size={14} color={D.dim} />
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, height: 38, border: "none", outline: "none", background: "transparent", fontSize: 13, color: D.ink, fontFamily: D.font }}
        />
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: D.sub, marginBottom: 6 }}>{label}</div>
      <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 8, background: D.surface, border: `1px solid ${D.lineSoft}`, fontSize: 13, color: D.muted }}>
        {value}
      </div>
    </div>
  );
}

function Notice({ notice }: { notice: { tone: "ok" | "error"; text: string } | null }) {
  if (!notice) return null;
  const tone = notice.tone === "ok" ? D.mint : D.red;
  return (
    <div role={notice.tone === "ok" ? "status" : "alert"} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12.5, color: tone, background: `color-mix(in srgb, ${tone} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)` }}>
      {notice.text}
    </div>
  );
}
