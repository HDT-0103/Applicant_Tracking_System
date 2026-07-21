"use client";

import React from "react";
import { useRouter } from 'next/navigation';
import { AppHeader } from "../components/AppHeader";
import { LeftSidebar } from "../components/LeftSidebar";
import { D } from "../lib/shared";
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  Clock,
  CheckCircle,
  ArrowRight,
  BarChart3
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  const stats = [
    { label: "Total Candidates", value: "1,247", icon: <Users size={20} strokeWidth={1.5} color={D.blue} />, change: "+12%", positive: true },
    { label: "Open Positions", value: "3", icon: <Briefcase size={20} strokeWidth={1.5} color={D.purple} />, change: "+1", positive: true },
    { label: "Applications Today", value: "24", icon: <TrendingUp size={20} strokeWidth={1.5} color={D.mint} />, change: "+8%", positive: true },
    { label: "Pending Reviews", value: "18", icon: <Clock size={20} strokeWidth={1.5} color={D.amber} />, change: "-3", positive: true },
  ];

  const recentCandidates = [
    { name: "Maya Lindqvist", role: "Senior ML Engineer", status: "Enriched", time: "2 hours ago", score: 92 },
    { name: "James Chen", role: "Full Stack Developer", status: "Enriched", time: "4 hours ago", score: 88 },
    { name: "Sarah Miller", role: "DevOps Engineer", status: "Processing", time: "6 hours ago", score: null },
    { name: "Alex Johnson", role: "Data Scientist", status: "Enriched", time: "1 day ago", score: 85 },
    { name: "Emily Davis", role: "Mobile Security Intern", status: "New", time: "1 day ago", score: null },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Sidebar */}
        <LeftSidebar />
        
        {/* Main Content */}
        <div style={{ flex: 1, overflow: "hidden", background: D.bg }}>
          <div style={{ padding: "32px 40px", height: "100%", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: D.ink, marginBottom: 8 }}>
                Dashboard Overview
              </h1>
              <p style={{ fontSize: 14, color: D.muted }}>
                Welcome back! Here's what's happening with your recruitment pipeline today.
              </p>
            </div>

            {/* Stats Grid */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(4, 1fr)", 
              gap: 20, 
              marginBottom: 32 
            }}>
              {stats.map((stat, index) => (
                <div
                  key={index}
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    background: D.canvas,
                    border: `1px solid ${D.line}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 8, 
                      background: `${D.blue}08`,
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center" 
                    }}>
                      {stat.icon}
                    </div>
                    <div style={{
                      padding: "4px 8px",
                      borderRadius: 99,
                      background: stat.positive ? `${D.mint}10` : `${D.red}10`,
                      fontSize: 11,
                      fontWeight: 600,
                      color: stat.positive ? D.mint : D.red
                    }}>
                      {stat.change}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: D.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                Quick Actions
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                <button
                  onClick={() => router.push("/careers")}
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    background: D.canvas,
                    border: `1px solid ${D.line}`,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${D.blue}08`;
                    e.currentTarget.style.borderColor = D.blue;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = D.canvas;
                    e.currentTarget.style.borderColor = D.line;
                  }}
                >
                  <div style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 10, 
                    background: `${D.blue}10`,
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Briefcase size={24} strokeWidth={1.5} color={D.blue} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: D.ink, marginBottom: 4 }}>
                      View Careers Portal
                    </div>
                    <div style={{ fontSize: 12, color: D.muted }}>
                      Manage job postings and applications
                    </div>
                  </div>
                  <ArrowRight size={18} strokeWidth={1.5} color={D.muted} />
                </button>

                <button
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    background: D.canvas,
                    border: `1px solid ${D.line}`,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${D.purple}08`;
                    e.currentTarget.style.borderColor = D.purple;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = D.canvas;
                    e.currentTarget.style.borderColor = D.line;
                  }}
                >
                  <div style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 10, 
                    background: `${D.purple}10`,
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <BarChart3 size={24} strokeWidth={1.5} color={D.purple} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: D.ink, marginBottom: 4 }}>
                      View Analytics
                    </div>
                    <div style={{ fontSize: 12, color: D.muted }}>
                      Recruitment metrics and insights
                    </div>
                  </div>
                  <ArrowRight size={18} strokeWidth={1.5} color={D.muted} />
                </button>
              </div>
            </div>

            {/* Recent Candidates */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink }}>
                  Recent Candidates
                </h2>
                <button
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "transparent",
                    border: `1px solid ${D.line}`,
                    color: D.sub,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer"
                  }}
                >
                  View All
                </button>
              </div>
              
              <div style={{
                borderRadius: 12,
                background: D.canvas,
                border: `1px solid ${D.line}`,
                overflow: "hidden"
              }}>
                {recentCandidates.map((candidate, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "16px 20px",
                      borderBottom: index < recentCandidates.length - 1 ? `1px solid ${D.line}` : "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = D.surface;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${D.blue} 0%, #4F46E5 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      flexShrink: 0
                    }}>
                      {candidate.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: D.ink, marginBottom: 2 }}>
                        {candidate.name}
                      </div>
                      <div style={{ fontSize: 12, color: D.muted }}>
                        {candidate.role}
                      </div>
                    </div>

                    <div style={{
                      padding: "4px 10px",
                      borderRadius: 99,
                      background: candidate.status === "Enriched" ? `${D.mint}10` : candidate.status === "Processing" ? `${D.amber}10` : `${D.blue}10`,
                      fontSize: 11,
                      fontWeight: 500,
                      color: candidate.status === "Enriched" ? D.mint : candidate.status === "Processing" ? D.amber : D.blue
                    }}>
                      {candidate.status}
                    </div>

                    {candidate.score !== null && (
                      <div style={{
                        padding: "4px 10px",
                        borderRadius: 99,
                        background: `${D.blue}10`,
                        fontSize: 11,
                        fontWeight: 600,
                        color: D.blue,
                        fontFamily: "monospace"
                      }}>
                        {candidate.score}% match
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: D.dim, minWidth: 60, textAlign: "right" }}>
                      {candidate.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
