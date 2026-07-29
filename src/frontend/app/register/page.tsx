"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Mail, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { T } from "../../components/auth/authTheme";
import { submitStyle } from "../../components/Login";

export default function RegisterPage() {
  const { registerWithEmailPassword } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await registerWithEmailPassword(name, email, password);
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
      subheading="Register as a recruiter to start hiring with SmartATS"
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
          Accounts register as recruiters. Elevated roles are granted by a system
          administrator.
        </p>
      </form>
    </AuthShell>
  );
}
