"use client";

import React, { useEffect, useRef, useState } from "react";
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
  Trophy,
  Users,
} from "lucide-react";
import { AppShell } from "../../../components/AppShell";
import { ReviewPanelPicker } from "../../../components/ReviewPanelPicker";
import { ShareLinkBox } from "../../../components/ShareLinkBox";
import { useAuth } from "../../../contexts/AuthContext";
import { D, tint } from "../../../lib/shared";
import { buildJobPath, buildJobUrl } from "../../../lib/jobUrl";
import { getJobPosting, getJobRanking, type RankedCandidate } from "../../../services/catalogService";
import { candidateDisplayName, isMasked } from "../../../lib/candidateLabel";
import { getPanel, type PanelMember } from "../../../services/panelService";
import { useLang, useT, type Vars } from "@/lib/i18n";

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

type Tab = "posting" | "candidate" | "ranking";

type T = (key: string, vars?: Vars) => string;

const formatDate = (iso: string | null | undefined, locale: string): string =>
  iso ? new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : "—";

const formatSalary = (min: number | null, max: number | null, locale: string, t: T): string | null => {
  if (min == null && max == null) return null;
  const fmt = (n: number) => n.toLocaleString(locale);
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  return min != null ? t("jobs.detail.salary.from", { n: fmt(min) }) : t("jobs.detail.salary.upTo", { n: fmt(max as number) });
};

// Trạng thái tin là giá trị DB (PUBLISHED/DRAFT/CLOSED); chỉ ba giá trị này có
// nhãn dịch — giá trị lạ thì hiện nguyên xi thay vì hiện tên key.
const KNOWN_STATUSES = new Set(["PUBLISHED", "DRAFT", "CLOSED"]);

export default function JobPostingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasRole } = useAuth();
  const { lang, t } = useLang();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  // t chỉ dùng cho câu lỗi trong effect nạp tin; đọc qua ref để đổi ngôn ngữ
  // không kéo theo một lần gọi API nữa.
  const tRef = useRef(t);
  tRef.current = t;
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
        setError(err instanceof Error ? err.message : tRef.current("jobs.detail.loadError"));
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
            border: `1px solid ${tint("red", "30")}`,
            background: `${tint("red", "0A")}`,
            color: D.red,
            fontSize: 13,
          }}
        >
          {error ?? t("jobs.detail.notFound")}
        </div>
      </AppShell>
    );
  }

  const publicPath = buildJobPath(job.id, job.job_title);
  const shareUrl = buildJobUrl(job.id, job.job_title);
  const salary = formatSalary(job.salary_min, job.salary_max, locale, t);
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
                  background: job.status === "PUBLISHED" ? `${tint("mint", "15")}` : D.surface,
                  color: job.status === "PUBLISHED" ? D.mint : D.muted,
                  border: `1px solid ${job.status === "PUBLISHED" ? `${tint("mint", "40")}` : D.line}`,
                }}
              >
                {KNOWN_STATUSES.has(job.status) ? t(`status.${job.status}`) : job.status}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: D.muted, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {postedBy && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Building2 size={13} /> {t("jobs.detail.postedBy", { name: postedBy })}
                </span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CalendarDays size={13} /> {t("jobs.detail.created", { date: formatDate(job.created_at, locale) })}
                {job.posted_at ? ` · ${t("jobs.detail.published", { date: formatDate(job.posted_at, locale) })}` : ""}
                {job.expires_at ? ` · ${t("jobs.detail.expires", { date: formatDate(job.expires_at, locale) })}` : ""}
              </span>
            </div>
          </div>
          {isHr && (
            <button
              type="button"
              onClick={() => router.push(`/job-postings/create?id=${job.id}`)}
              className="px-4 py-2 rounded-lg border border-border bg-white text-xs font-semibold text-foreground hover:bg-[#f4f5f7] transition-colors flex items-center gap-2"
            >
              <Pencil className="w-3.5 h-3.5" /> {t("common.edit")}
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div role="tablist" className="flex items-center gap-2 mb-6 border-b border-border pb-3">
          {tabButton("posting", t("jobs.detail.tab.posting"), FileText)}
          {tabButton("candidate", t("jobs.detail.tab.candidate"), Eye)}
          {tabButton("ranking", t("jobs.detail.tab.ranking"), Trophy)}
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {t("jobs.detail.openPublic")}
          </a>
        </div>

        {tab === "posting" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24, alignItems: "start" }}>
            {/* Cột trái: nội dung tin */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section style={card}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                  <Fact icon={MapPin} label={t("jobs.detail.fact.location")} value={job.location} />
                  <Fact icon={Briefcase} label={t("jobs.detail.fact.department")} value={job.department} />
                  <Fact icon={Briefcase} label={t("jobs.detail.fact.employmentType")} value={job.employment_type} />
                  <Fact icon={Briefcase} label={t("jobs.detail.fact.workMode")} value={job.work_mode} />
                  <Fact icon={Briefcase} label={t("jobs.detail.fact.seniority")} value={job.seniority_level} />
                  <Fact icon={Users} label={t("jobs.detail.fact.openings")} value={job.target_openings != null ? String(job.target_openings) : null} />
                  <Fact icon={Briefcase} label={t("jobs.detail.fact.salary")} value={salary} />
                </div>
              </section>

              <Section title={t("jobs.detail.section.overview")} text={job.description} />
              <Section title={t("jobs.detail.section.responsibilities")} text={job.key_responsibilities} />
              <Section title={t("jobs.detail.section.requirements")} text={job.requirements} />
              <Section title={t("jobs.detail.section.niceToHave")} text={job.nice_to_have_qualifications} />

              <section style={card}>
                <SkillRow label={t("jobs.detail.skills.must")} skills={job.must_have_skills ?? []} strong />
                <div style={{ height: 12 }} />
                <SkillRow label={t("jobs.detail.skills.nice")} skills={job.nice_to_have_skills ?? []} />
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
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: D.ink }}>{t("jobs.panel.title")}</span>
                  </div>
                  {panel.length === 0 ? (
                    <div style={{ fontSize: 12, color: D.muted }}>{t("jobs.detail.panel.empty")}</div>
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

        {tab === "ranking" && <RankingTab jobPostingId={job.id} locale={locale} />}

        {tab === "candidate" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: D.muted }}>
              {t("jobs.detail.previewNote")}
            </div>
            <iframe
              title={t("jobs.detail.tab.candidate")}
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
  const t = useT();
  return (
    <section style={card}>
      <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: D.blue, margin: "0 0 8px" }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: text ? D.ink : D.dim, margin: 0, whiteSpace: "pre-line" }}>
        {text || t("common.notProvided")}
      </p>
    </section>
  );
}

function SkillRow({ label, skills, strong = false }: { label: string; skills: string[]; strong?: boolean }) {
  const t = useT();
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.dim, marginBottom: 6 }}>{label}</div>
      {skills.length === 0 ? (
        <span style={{ fontSize: 12, color: D.dim, fontStyle: "italic" }}>{t("jobs.detail.skills.none")}</span>
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
                background: strong ? `${tint("blue", "10")}` : D.surface,
                color: strong ? D.blue : D.sub,
                border: `1px solid ${strong ? `${tint("blue", "25")}` : D.lineSoft}`,
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

/**
 * Bảng xếp hạng ứng viên của tin, theo `applications.overall_score`.
 *
 * Điểm là cosine CV↔tin do pipeline CV tính khi hồ sơ nộp vào; `null` là chưa
 * chấm (pipeline đang chạy nền, hoặc CV không có text) — hiện "Chưa chấm",
 * KHÔNG hiện 0%. Tên bị ABAC che thì dùng nhãn `Candidate #xxxxxxxx` chung.
 */
function RankingTab({ jobPostingId, locale }: { jobPostingId: string; locale: string }) {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState<RankedCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    getJobRanking(jobPostingId)
      .then((data) => alive && setRows(data))
      .catch((err) => alive && setError(err instanceof Error ? err.message : t("jobs.ranking.loadError")));
    return () => {
      alive = false;
    };
    // t đổi theo ngôn ngữ không cần tải lại bảng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobPostingId]);

  if (error) {
    return (
      <div role="alert" style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${tint("red", "30")}`, background: tint("red", "0A"), color: D.red, fontSize: 13 }}>
        {error}
      </div>
    );
  }
  if (rows === null) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Loader2 size={24} className="animate-spin" color={D.blue} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: D.muted }}>{t("jobs.ranking.note")}</div>
      {rows.length === 0 ? (
        <section style={card}>
          <div style={{ fontSize: 13, color: D.muted }}>{t("jobs.ranking.empty")}</div>
        </section>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, index) => (
            <RankingRow
              key={r.application_id}
              rank={index + 1}
              row={r}
              locale={locale}
              onOpen={() => router.push(`/candidate-profile/enriched?uuid=${r.candidate_uuid}`)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function readMustHaveCoverage(matrix: Record<string, unknown> | null): { matched: number; total: number } | null {
  const mustHave = matrix && typeof matrix === "object" ? (matrix as { must_have?: unknown }).must_have : null;
  if (!mustHave || typeof mustHave !== "object") return null;
  const { matched, missing } = mustHave as { matched?: unknown; missing?: unknown };
  if (!Array.isArray(matched) || !Array.isArray(missing)) return null;
  const total = matched.length + missing.length;
  return total > 0 ? { matched: matched.length, total } : null;
}

function RankingRow({
  rank,
  row,
  locale,
  onOpen,
}: {
  rank: number;
  row: RankedCandidate;
  locale: string;
  onOpen: () => void;
}) {
  const t = useT();
  const scored = typeof row.overall_score === "number";
  const percent = scored ? Math.round((row.overall_score as number) * 100) : null;
  const coverage = readMustHaveCoverage(row.skills_matrix);
  const submitted = row.submitted_at
    ? new Date(row.submitted_at).toLocaleDateString(locale, { day: "2-digit", month: "short" })
    : null;
  const tone = percent === null ? D.muted : percent >= 70 ? D.mint : percent >= 40 ? D.amber : D.red;

  return (
    <li
      onClick={onOpen}
      style={{
        ...card,
        padding: "12px 16px",
        display: "grid",
        gridTemplateColumns: "32px minmax(0, 1fr) 160px",
        gap: 14,
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: D.muted, textAlign: "center" }}>{rank}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: D.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {candidateDisplayName(row.full_name, row.candidate_uuid)}
        </div>
        <div style={{ fontSize: 11.5, color: D.muted, display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
          {row.email && !isMasked(row.email) && <span>{row.email}</span>}
          {submitted && <span>{t("jobs.ranking.submitted", { date: submitted })}</span>}
          {coverage && (
            <span>
              {t("jobs.ranking.mustHave")} {coverage.matched}/{coverage.total}
            </span>
          )}
        </div>
        {row.skills.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {row.skills.slice(0, 8).map((skill) => (
              <span key={skill} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: D.surface, border: `1px solid ${D.lineSoft}`, color: D.ink }}>
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        {percent === null ? (
          <div style={{ fontSize: 12, color: D.muted, textAlign: "right" }}>{t("jobs.ranking.unscored")}</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: D.muted }}>{t("jobs.ranking.match")}</span>
              <span style={{ fontWeight: 700, color: tone }}>{percent}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: D.surface, overflow: "hidden" }}>
              <div style={{ width: `${percent}%`, height: "100%", background: tone }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: D.muted, marginTop: 4 }}>
              <span>
                {t("jobs.ranking.summary")} {row.summary_score === null ? "–" : Math.round(row.summary_score * 100)}
              </span>
              <span>
                {t("jobs.ranking.experience")} {row.experience_score === null ? "–" : Math.round(row.experience_score * 100)}
              </span>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
