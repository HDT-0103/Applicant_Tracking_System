"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { AppShell } from "../components/AppShell";
import { D } from "../lib/shared";
import {
  firstOf,
  readMustHave,
  topLanguages,
  candidateContext,
} from "../lib/candidateSummary";
import { guarded, supabase } from "../lib/db";
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
  /** "Công ty · Địa điểm" — bỏ trống vế nào thiếu, không hiện dấu chấm mồ côi. */
  context: string | null;
  /** Ngôn ngữ dùng nhiều nhất trên GitHub, tối đa 3. */
  languages: string[];
  repoCount: number | null;
  /** Khớp bao nhiêu trên tổng số kỹ năng BẮT BUỘC của tin tuyển dụng. */
  mustHave: { matched: number; total: number } | null;
}

export default function HomePage() {
  const router = useRouter();
  const [recentCandidates, setRecentCandidates] = useState<RecentCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
      const data = await guarded('load recent candidates', () => supabase
        .from('candidates')
        // Chỉ lấy trường phục vụ quyết định tuyển dụng.
        // CỐ Ý KHÔNG lấy race / gender_identity / disability_status /
        // military_status / age_group: đó là dữ liệu EEO cho báo cáo tổng hợp,
        // đưa lên màn hình sàng lọc là tạo thiên kiến ngay chỗ ra quyết định.
        // Backend cũng đã che chúng (xem abac.ALWAYS_REDACTED_FIELDS).
        .select(`
          uuid,
          full_name,
          created_at,
          current_company,
          current_location,
          applications!left (
            job_posting_id,
            jobs_posting!left (job_title)
          ),
          enrichment_profiles!left (
            enrichment_status,
            match_confidence_score,
            skill_matrix
          ),
          github_profiles!left (
            public_repos_count,
            top_languages
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10));

      if (!mounted) return;
      setLoadingCandidates(false);
      if (!data) return;

      const mapped: RecentCandidate[] = data.map((c: any) => {
        const app = firstOf<any>(c.applications);
        const ep = firstOf<any>(c.enrichment_profiles);
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

        const gh = firstOf<any>(c.github_profiles);

        return {
          uuid: c.uuid,
          name: c.full_name || 'Unknown',
          role: app?.jobs_posting?.job_title || 'N/A',
          status,
          time,
          score: ep?.match_confidence_score ?? null,
          context: candidateContext(c.current_company, c.current_location),
          languages: topLanguages(gh?.top_languages),
          repoCount: gh?.public_repos_count ?? null,
          mustHave: readMustHave(ep?.skill_matrix),
        };
      });

      setRecentCandidates(mapped);
      } catch (err) {
        // `guarded` has already signed the user out and redirected when the
        // session is the problem. Anything else is a query failure worth
        // surfacing rather than leaving the list spinning forever.
        if (!mounted) return;
        setLoadingCandidates(false);
        console.error(err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <AppShell>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: D.ink, marginBottom: 8 }}>
                Dashboard Overview
              </h1>
              <p style={{ fontSize: 14, color: D.muted }}>
                Welcome back! Here&apos;s what&apos;s happening with your recruitment pipeline today.
              </p>
            </div>



            {/* Quick Actions */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: D.ink, marginBottom: 16 }}>
                Quick Actions
              </h2>
              <div style={{ display: "flex", flexDirection: "column" }}>

                <button
                  type="button"
                  onClick={() => router.push('/analytics')}
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
                  type="button"
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
                      background: `linear-gradient(135deg, ${D.blue} 0%, ${D.blueDeep} 100%)`,
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
                      <div style={{ fontSize: 12, color: D.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{candidate.role}</span>
                        {candidate.context && (
                          <>
                            <span style={{ color: D.dim }}>•</span>
                            <span>{candidate.context}</span>
                          </>
                        )}
                      </div>

                      {/* Bằng chứng kỹ thuật rút từ GitHub. Hiện ngay ở danh sách
                          để người tuyển dụng không phải mở từng hồ sơ mới biết
                          ứng viên làm ngôn ngữ gì. */}
                      {(candidate.languages.length > 0 || candidate.repoCount !== null) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                          {candidate.languages.map((lang) => (
                            <span
                              key={lang}
                              style={{
                                padding: "1px 6px",
                                borderRadius: D.r1,
                                background: D.surface,
                                border: `1px solid ${D.lineSoft}`,
                                fontSize: 10.5,
                                color: D.sub,
                              }}
                            >
                              {lang}
                            </span>
                          ))}
                          {candidate.repoCount !== null && (
                            <span style={{ fontSize: 10.5, color: D.dim }}>
                              {candidate.repoCount} repo
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Khớp bao nhiêu kỹ năng BẮT BUỘC — phần "vì sao" đứng sau
                        điểm số. Một con số trần trụi thì không ai dám tin. */}
                    {candidate.mustHave && (
                      <div
                        title={`Matches ${candidate.mustHave.matched} of ${candidate.mustHave.total} required skills`}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: D.mono,
                          background:
                            candidate.mustHave.matched === candidate.mustHave.total
                              ? `${D.mint}10`
                              : `${D.amber}10`,
                          color:
                            candidate.mustHave.matched === candidate.mustHave.total
                              ? D.mint
                              : D.amber,
                        }}
                      >
                        {candidate.mustHave.matched}/{candidate.mustHave.total} skills
                      </div>
                    )}

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
    </AppShell>
  );
}
