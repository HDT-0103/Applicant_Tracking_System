"use client";

import React from "react";

export const SkeletonLoadingSpinner: React.FC = () => (
  <div className="skeleton-workspace">
    {/* Candidate name + badge row */}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div className="sk" style={{ height: 28, width: "55%" }} />
        <div className="sk" style={{ height: 14, width: "40%" }} />
      </div>
      <div className="sk" style={{ height: 28, width: 160, borderRadius: 20 }} />
    </div>

    {/* Meta tags */}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[80, 100, 110, 90].map((w, i) => (
        <div key={i} className="sk" style={{ height: 24, width: w, borderRadius: 6 }} />
      ))}
    </div>

    {/* Affinity score */}
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="sk" style={{ height: 11, width: 120 }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className="sk" style={{ height: 52, width: 90, borderRadius: 4 }} />
        <div className="sk" style={{ height: 20, width: 120, borderRadius: 20 }} />
      </div>
      {["Experience", "Skills Fit", "Culture"].map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="sk" style={{ height: 12, width: 70 }} />
          <div className="sk" style={{ height: 6, flex: 1 }} />
          <div className="sk" style={{ height: 12, width: 28 }} />
        </div>
      ))}
    </div>

    {/* Radar chart placeholder */}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="sk" style={{ height: 11, width: 130 }} />
      <div className="sk" style={{ height: 11, width: 200 }} />
      <div className="sk" style={{ height: 200, borderRadius: 8, marginTop: 4 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="sk" style={{ height: 52, flex: 1, borderRadius: 8 }} />
        ))}
      </div>
    </div>

    {/* Career timeline placeholder */}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="sk" style={{ height: 11, width: 110 }} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 24, position: "relative" }}>
          <div
            className="sk"
            style={{ width: 10, height: 10, borderRadius: "50%", position: "absolute", left: 0, top: 4 }}
          />
          <div className="sk" style={{ height: 13, width: "50%" }} />
          <div className="sk" style={{ height: 11, width: "35%" }} />
          <div className="sk" style={{ height: 11, width: "80%" }} />
        </div>
      ))}
    </div>
  </div>
);
