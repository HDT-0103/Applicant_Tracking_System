"use client";

import React, { useState } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";

export const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was cancelled or failed.");
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">S</div>
          <h1 className="login-title">SmartATS</h1>
          <p className="login-subtitle">
            Applicant Tracking &amp; AI Verification
          </p>
        </div>

        <div className="login-divider" />

        <p className="login-description">
          Sign in with your organization Google account to access the ingestion
          workspace, candidate analytics, and interview scheduling tools.
        </p>

        <div className="login-actions">
          {clientId ? (
            <div className={`google-login-wrap${isSubmitting ? " disabled" : ""}`}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
                width={320}
              />
            </div>
          ) : (
            <div className="login-config-warning" role="alert">
              Missing <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>. Add it to your
              <code>.env</code> file to enable Google OAuth.
            </div>
          )}

          {isSubmitting && (
            <p className="login-status">Verifying credentials…</p>
          )}

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="login-roles">
          <span className="role-badge recruiter">Recruiter</span>
          <span className="role-badge interviewer">Interviewer</span>
          <p className="login-roles-hint">
            Role is assigned automatically based on your organization profile.
          </p>
        </div>
      </div>

      <footer className="login-footer">
        Secured by JWT · Google OAuth 2.0 · SmartATS v4.2
      </footer>
    </div>
  );
};
