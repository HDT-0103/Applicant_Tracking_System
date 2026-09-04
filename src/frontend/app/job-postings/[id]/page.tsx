"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { AppShell } from "../../../components/AppShell";
import { ReviewPanelPicker } from "../../../components/ReviewPanelPicker";
import { ShareLinkBox } from "../../../components/ShareLinkBox";
import { useAuth } from "../../../contexts/AuthContext";
import { D } from "../../../lib/shared";
import { buildJobPath, buildJobUrl } from "../../../lib/jobUrl";
import { getJobPosting } from "../../../services/catalogService";
import { getPanel, type PanelMember } from "../../../services/panelService";

/**
 * Trang chi tiết một tin tuyển dụng — cho cả HR lẫn Tech Lead trong hội đồng.
 *
 * Trước đây bấm vào tin ở sidebar là nhảy thẳng sang /careers/<tên>, tức là
 * form ứng viên: HR không thấy lại tin mình đã soạn, không thấy link nộp hồ
 * sơ (chỉ hiện ở bước 3 của wizard), và tin chưa PUBLISHED thì ra "not found".
 *
 * Hai tab, một trang:
 *   - "Job posting": mọi thứ HR đã nhập + ai đăng + hội đồng Tech Lead + link.
 *   - "Candidate view": nhúng đúng trang ứng viên thấy (`?preview=1`, không
 *     gửi được gì), để không phải nuôi hai bản của cùng một form.
 */

interface JobDetail {
  id: string;
  job_title: string;
  department: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  seniority_level: string | null;
  target_openings: number | null;
  salary_min: number | null;
  salary_max: number | null;
  must_have_skills: string[] | null;
  nice_to_have_skills: string[] | null;
  description: string | null;
  key_responsibilities: string | null;
  requirements: string | null;
  nice_to_have_qualifications: string | null;
  status: string;
  posted_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  created_by_name: string | null;
  created_by_company: string | null;
}

type Tab = "posting" | "candidate";

const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const formatSalary = (min: number | null, max: number | null): string | null => {
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  return min != null ? `From ${fmt(min)}` : `Up to ${fmt(max as number)}`;
};

export default function JobPostingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasRole } = useAuth();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [job, setJob] = useState<JobDetail | null>(null);
  const [panel, setPanel] = useState<PanelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("posting");

  const isHr = hasRole("hr");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getJobPosting(id), getPanel(id)])
      .then(([row, members]) => {
        if (!alive) return;
        setJob(row as JobDetail);
        setPanel(members);
      })
      .catch((err) => {
        if (!alive) return;
        // Backend trả 404 cho tin ngoài phạm vi (không phải của mình / không
        // trong hội đồng) — nói đúng như vậy, đừng nói "lỗi máy chủ".
        setError(err instanceof Error ? err.message : "This job posting could not be loaded.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loader2 size={28} className="animate-spin" color={D.blue} />
        </div>
      </AppShell>
    );
  }

  if (error || !job) {
    return (
      <AppShell>
        <div
          role="alert"
          style={{
            padding: "14px 16px",
            borderRadius: 8,
            border: `1px solid ${D.red}30`,
            background: `${D.red}0A`,
            color: D.red,
            fontSize: 13,
          }}
        >
          {error ?? "Job posting not found."}
        </div>
      </AppShell>
    );
  }

  const publicPath = buildJobPath(job.id, job.job_title);
  const shareUrl = buildJobUrl(job.id, job.job_title);
  const salary = formatSalary(job.salary_min, job.salary_max);
  const postedBy = [job.created_by_name, job.created_by_company].filter(Boolean).join(" · ");

  const tabButton = (key: Tab, label: string, Icon: typeof FileText) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
        tab === key
          ? "bg-primary text-white shadow-sm shadow-primary/20"
          : "bg-white text-muted-foreground hover:text-foreground border border-border"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  return (
    <AppShell scroll={tab === "posting"} padded={tab === "posting"}>
      <div style={{ padding: tab === "posting" ? 0 : "20px 24px 0", display: "flex", flexDirection: "column", height: tab === "candidate" ? "100%" : undefined }}>
        {/* Tiêu đề + trạng thái + Edit */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: D.ink, margin: 0 }}>{job.job_title}</h1>
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: 99,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  background: job.status === "PUBLISHED" ? `${D.mint}15` : D.surface,
                  color: job.status === "PUBLISHED" ? D.mint : D.muted,
                  border: `1px solid ${job.status === "PUBLISHED" ? `${D.mint}40` : D.line}`,
                }}
              >
                {job.status}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: D.muted, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {postedBy && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Building2 size={13} /> Posted by {postedBy}
                </span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CalendarDays size={13} /> Created {formatDate(job.created_at)}
                {job.posted_at ? ` · Published ${formatDate(job.posted_at)}` : ""}
                {job.expires_at ? ` · Expires ${formatDate(job.expires_at)}` : ""}
              </span>
            </div>
          </div>
          {isHr && (
            <button
              type="button"
              onClick={() => router.push(`/job-postings/create?id=${job.id}`)}
              className="px-4 py-2 rounded-lg border border-border bg-white text-xs font-semibold text-foreground hover:bg-[#f4f5f7] transition-colors flex items-center gap-2"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div role="tablist" className="flex items-center gap-2 mb-6 border-b border-border pb-3">
          {tabButton("posting", "Job posting", FileText)}
          {tabButton("candidate", "Candidate view", Eye)}
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open public page
          </a>
        </div>

        {tab === "posting" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24, alignItems: "start" }}>
            {/* Cột trái: nội dung tin */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section style={card}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                  <Fact icon={MapPin} label="Location" value={job.location} />
                  <Fact icon={Briefcase} label="Department" value={job.department} />
                  <Fact icon={Briefcase} label="Employment type" value={job.employment_type} />
                  <Fact icon={Briefcase} label="Work mode" value={job.work_mode} />
                  <Fact icon={Briefcase} label="Seniority" value={job.seniority_level} />
                  <Fact icon={Users} label="Openings" value={job.target_openings != null ? String(job.target_openings) : null} />
                  <Fact icon={Briefcase} label="Salary" value={salary} />
                </div>
              </section>

              <Section title="Overview" text={job.description} />
              <Section title="Key responsibilities" text={job.key_responsibilities} />
              <Section title="Requirements" text={job.requirements} />
              <Section title="Nice-to-have qualifications" text={job.nice_to_have_qualifications} />

              <section style={card}>
                <SkillRow label="Must-have skills" skills={job.must_have_skills ?? []} strong />
                <div style={{ height: 12 }} />
                <SkillRow label="Nice-to-have skills" skills={job.nice_to_have_skills ?? []} />
              </section>
            </div>

            {/* Cột phải: link + hội đồng */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section style={card}>
                <ShareLinkBox url={shareUrl} />
              </section>

              {isHr ? (
                <ReviewPanelPicker jobPostingId={job.id} />
              ) : (
                <section style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Users size={15} strokeWidth={1.8} color={D.blue} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: D.ink }}>Review panel</span>
                  </div>
                  {panel.length === 0 ? (
                    <div style={{ fontSize: 12, color: D.muted }}>No Tech Lead has been invited yet.</div>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {panel.map((m) => (
                        <li
                          key={m.reviewer_id}
                          style={{ padding: "7px 10px", borderRadius: 6, background: D.surface, border: `1px solid ${D.lineSoft}` }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: D.ink }}>{m.name}</div>
                          <div style={{ fontSize: 10.5, color: D.muted }}>{m.email}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
        )}

        {tab === "candidate" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: D.muted }}>
              This is the live application page a candidate sees. Submitting is disabled in this preview.
            </div>
            <iframe
              title="Candidate view"
              src={`${publicPath}?preview=1`}
              style={{ flex: 1, width: "100%", minHeight: 720, border: `1px solid ${D.line}`, borderRadius: 10, background: "#fff" }}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

const card: React.CSSProperties = {
  border: `1px solid ${D.line}`,
  borderRadius: 10,
  background: D.canvas,
  padding: 18,
};

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.dim, display: "flex", alignItems: "center", gap: 5 }}>
        <Icon size={11} /> {label}
      </div>
      <div style={{ fontSize: 13, color: value ? D.ink : D.dim, marginTop: 3 }}>{value || "—"}</div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  return (
    <section style={card}>
      <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: D.blue, margin: "0 0 8px" }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: text ? D.ink : D.dim, margin: 0, whiteSpace: "pre-line" }}>
        {text || "Not provided."}
      </p>
    </section>
  );
}

function SkillRow({ label, skills, strong = false }: { label: string; skills: string[]; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.dim, marginBottom: 6 }}>{label}</div>
      {skills.length === 0 ? (
        <span style={{ fontSize: 12, color: D.dim, fontStyle: "italic" }}>None listed</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {skills.map((s) => (
            <span
              key={s}
              style={{
                padding: "3px 9px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: strong ? 600 : 500,
                background: strong ? `${D.blue}10` : D.surface,
                color: strong ? D.blue : D.sub,
                border: `1px solid ${strong ? `${D.blue}25` : D.lineSoft}`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
