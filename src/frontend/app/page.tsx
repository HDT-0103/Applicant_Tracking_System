"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { AppHeader } from "../components/AppHeader";
import { LeftSidebar } from "../components/LeftSidebar";
import { D } from "../lib/shared";
import { supabase } from "../lib/supabase";
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  Clock,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Loader2,
} from "lucide-react";

interface RecentCandidate {
  uuid: string;
  name: string;
  role: string;
  status: string;
  time: string;
  score: number | null;
}

export default function HomePage() {
  const router = useRouter();
  const [recentCandidates, setRecentCandidates] = useState<RecentCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          uuid,
          full_name,
          created_at,
          applications!left (
            job_posting_id,
            jobs_posting!left (job_title)
          ),
          enrichment_profiles!left (
            enrichment_status,
            match_confidence_score
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!mounted) return;
      setLoadingCandidates(false);
      if (error || !data) return;

      const mapped: RecentCandidate[] = data.map((c: any) => {
        const app = c.applications?.[0];
        const ep = c.enrichment_profiles?.[0];
        const statusRaw = ep?.enrichment_status || 'CREATED';
        let status = 'Created';
        if (statusRaw === 'ENRICHED') status = 'Enriched';
        else if (statusRaw === 'QUEUED' || statusRaw === 'IN_PROGRESS') status = 'Processing';
        else if (statusRaw === 'ENRICHMENT_FAILED' || statusRaw === 'NO_PROFILES_FOUND') status = 'Failed';

        const ts = c.created_at ? new Date(c.created_at).getTime() : Date.now();
        const elapsed = Date.now() - ts;
        let time: string;
        if (elapsed < 60000) time = 'Just now';
        else if (elapsed < 3600000) time = `${Math.floor(elapsed / 60000)}m ago`;
        else if (elapsed < 86400000) time = `${Math.floor(elapsed / 3600000)}h ago`;
        else time = `${Math.floor(elapsed / 86400000)}d ago`;

        return {
          uuid: c.uuid,
          name: c.full_name || 'Unknown',
          role: app?.jobs_posting?.job_title || 'N/A',
          status,
          time,
          score: ep?.match_confidence_score ?? null,
        };
      });

      setRecentCandidates(mapped);
    })();
    return () => { mounted = false; };
  }, []);

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



            {/* Quick Actions */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                Quick Actions
              </h2>
              <div style={{ display: "flex", flexDirection: "column" }}>

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
                {loadingCandidates ? (
                  <div style={{ padding: "24px", textAlign: "center" }}>
                    <Loader2 size={20} strokeWidth={2} color={D.muted} style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                ) : recentCandidates.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: D.muted }}>No candidates yet</p>
                  </div>
                ) : recentCandidates.map((candidate, index) => (
                  <div
                    key={candidate.uuid}
                    onClick={() => router.push(`/candidate-profile/enriched?uuid=${candidate.uuid}`)}
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
