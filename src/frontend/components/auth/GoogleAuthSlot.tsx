"use client";

import React from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { T } from "./authTheme";

interface GoogleAuthSlotProps {
  onSuccess: (res: CredentialResponse) => void;
  onError: () => void;
  disabled?: boolean;
  text?: "signin_with" | "signup_with";
}

/**
 * Nếu thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID -> KHÔNG hiện hộp cảnh báo env thô nữa,
 * mà render một nút Google disabled gọn gàng (đúng tinh thần B2B §4.2).
 */
export const GoogleAuthSlot: React.FC<GoogleAuthSlotProps> = ({
  onSuccess,
  onError,
  disabled = false,
  text = "signin_with",
}) => {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in unavailable"
        style={{
          width: "100%",
          height: T.field,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: T.page,
          border: `1px solid ${T.line}`,
          borderRadius: T.radius,
          color: T.dim,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: T.font,
          cursor: "not-allowed",
        }}
      >
        <GoogleGlyph muted />
        {text === "signup_with" ? "Sign up with Google" : "Sign in with Google"}
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        useOneTap={false}
        theme="outline"
        size="large"
        text={text}
        shape="rectangular"
        width={380}
      />
    </div>
  );
};

const GoogleGlyph: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    {muted ? (
      <path
        fill="currentColor"
        d="M44 20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.4-8 19.4-20 0-1.3-.1-2.7-.4-4z"
      />
    ) : (
      <>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 41.6 44 36.4 44 24c0-1.3-.1-2.6-.4-3.5z" />
      </>
    )}
  </svg>
);
