"use client";

import React from "react";
import { useAuth, type UserRole } from "../../context/AuthContext";

const ROLE_LABELS: Record<UserRole, string> = {
  recruiter: "Recruiter",
  interviewer: "Interviewer",
  admin: "Admin",
};

export const AppHeader: React.FC = () => {
  const { user, logout, canUpload } = useAuth();

  if (!user) return null;

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <span className="app-header-logo">SmartATS</span>
        <span className="app-header-tag">Ingestion Workspace</span>
      </div>

      <div className="app-header-user">
        {!canUpload && (
          <span className="app-header-readonly">View only</span>
        )}
        <span className={`role-badge ${user.role}`}>
          {ROLE_LABELS[user.role]}
        </span>
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            className="app-header-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="app-header-avatar-fallback">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="app-header-identity">
          <span className="app-header-name">{user.name}</span>
          <span className="app-header-email">{user.email}</span>
        </div>
        <button type="button" className="app-header-logout" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
};
