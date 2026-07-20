"use client";

import React, { useState } from "react";
import Link from "next/link";
import { type CredentialResponse } from "@react-oauth/google";
import { Mail, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AuthShell } from "./auth/AuthShell";
import { AuthField } from "./auth/AuthField";
import { GoogleAuthSlot } from "./auth/GoogleAuthSlot";
import { T } from "./auth/authTheme";

export const Login: React.FC = () => {
  const { loginWithGoogle, loginWithEmailPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await loginWithEmailPassword(email, password);
      // Redirect is handled in AuthContext based on the user's role.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    const credential = response.credential;
    if (!credential) {
      setError("Google did not return a valid credential.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle(credential);
      // Redirect is handled in AuthContext based on the user's role.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      heading="Sign in"
      subheading="Access your SmartATS workspace"
      error={error}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: T.primary, fontWeight: 600, textDecoration: "none" }}>
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleEmailLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          icon={Mail}
          autoComplete="email"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          icon={KeyRound}
          autoComplete="current-password"
        />

        <button type="submit" disabled={isSubmitting} style={submitStyle(isSubmitting)}>
          {isSubmitting ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <Divider />

      <GoogleAuthSlot onSuccess={handleGoogleSuccess} onError={() => setError("Google sign-in was cancelled or failed.")} disabled={isSubmitting} text="signin_with" />
    </AuthShell>
  );
};

const Divider: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", margin: "20px 0" }}>
    <div style={{ flex: 1, height: 1, background: T.line }} />
    <span style={{ fontSize: 11, color: T.dim, margin: "0 12px", fontWeight: 600, letterSpacing: "0.04em" }}>OR</span>
    <div style={{ flex: 1, height: 1, background: T.line }} />
  </div>
);

export const submitStyle = (isSubmitting: boolean): React.CSSProperties => ({
  width: "100%",
  height: T.field,
  marginTop: 4,
  background: T.primary,
  border: "none",
  borderRadius: T.radius,
  color: T.primaryInk,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: T.font,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: isSubmitting ? "default" : "pointer",
  opacity: isSubmitting ? 0.75 : 1,
  transition: "background .15s ease, opacity .15s ease",
});
