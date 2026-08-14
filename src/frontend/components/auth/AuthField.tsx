"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { T } from "./authTheme";

interface AuthFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon: LucideIcon;
  autoComplete?: string;
  required?: boolean;
}

export const AuthField: React.FC<AuthFieldProps> = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon: Icon,
  autoComplete,
  required = true,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: T.sub,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <Icon
          size={16}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: focused ? T.primary : T.dim,
            transition: "color .15s ease",
          }}
        />
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            height: T.field,
            padding: "0 12px 0 38px",
            background: T.page,
            border: `1px solid ${focused ? T.primary : T.line}`,
            borderRadius: T.radius,
            color: T.ink,
            fontSize: 14,
            fontFamily: T.font,
            outline: "none",
            boxShadow: focused ? `0 0 0 3px ${T.ring}` : "none",
            transition: "border-color .15s ease, box-shadow .15s ease",
          }}
        />
      </div>
    </div>
  );
};
