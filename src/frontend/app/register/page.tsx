"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Mail, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  ROLE_LABELS,
  SELF_SIGNUP_ROLES,
  SELF_SIGNUP_ROLE_HINTS,
  type SelfSignupRole,
} from "../../lib/rbac";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { T } from "../../components/auth/authTheme";
import { submitStyle } from "../../components/Login";

export default function RegisterPage() {
  const { registerWithEmailPassword } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Mặc định `hr` — cũng là mặc định của backend khi thiếu trường này, nên hai
  // bên không lệch nhau nếu ai đó gọi API thẳng.
  const [role, setRole] = useState<SelfSignupRole>("hr");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await registerWithEmailPassword(name, email, password, role);
      // Redirect is handled in AuthContext (recruiters land on the workspace).
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      heading="Create your account"
      subheading="Chọn vai trò của bạn để bắt đầu với SmartATS"
      error={error}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" style={{ color: T.primary, fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AuthField
          id="name"
          label="Full name"
          value={name}
          onChange={setName}
          placeholder="Jane Doe"
          icon={User}
          autoComplete="name"
        />
        <AuthField
          id="email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="jane@company.com"
          icon={Mail}
          autoComplete="email"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Min. 6 characters"
          icon={KeyRound}
          autoComplete="new-password"
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
            I am joining as
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
                      {ROLE_LABELS[option]}
                    </span>
                    <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                      {SELF_SIGNUP_ROLE_HINTS[option]}
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
              <span>Creating account…</span>
            </>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <p style={{ fontSize: 12, color: T.dim, textAlign: "center", margin: "2px 0 0", lineHeight: 1.5 }}>
          Quyền quản trị hệ thống không tự đăng ký được — chỉ quản trị viên cấp.
        </p>
      </form>
    </AuthShell>
  );
}
