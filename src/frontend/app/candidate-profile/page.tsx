"use client";

import React from "react";
import { AppHeader } from "../../components/AppHeader";

export default function CandidateProfilePage() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
          <h2 style={{ margin: "0 0 12px", color: "#0D1117", fontWeight: 700 }}>Candidate Profile Page</h2>
          <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>Click &quot;Run Sync&quot; in the header to see the enriched profile</p>
        </div>
      </div>
    </div>
  );
}
