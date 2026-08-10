"use client";

import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter, useParams } from 'next/navigation';
import { D } from "../../../lib/shared";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { buildJobPath, parseJobId } from "../../../lib/jobUrl";
import {
  AVAILABILITY_OPTIONS,
  MOTIVATION_OPTIONS,
  RATING_HINTS,
  SALARY_BASIS_OPTIONS,
  WORK_MODE_OPTIONS,
  WORK_STYLE_OPTIONS,
  buildScreeningPayload,
  formatVnd,
  pickRatedSkills,
  screeningAnswersFromRow,
  toAmount,
  validateScreening,
  type Choice,
  type ScreeningAnswers,
} from "../../../lib/screening";
import {
  clearStoredApplication,
  readStoredApplication,
  writeStoredApplication,
  type StoredApplicationRef,
} from "../../../lib/applicationStorage";
import {
  Upload,
  FileText,
  X,
  MapPin,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Globe,
  ExternalLink,
  ChevronDown,
  Search,
  Check,
  GraduationCap,
  Linkedin,
  Github,
  Twitter,
  Link2,
  Users,
  BookOpen,
  Star,
  GitFork,
  Briefcase,
  Clock,
} from "lucide-react";

type Phase = "form" | "loading" | "results";

interface FormData {
  resume: File | null;
  /* Five questions a CV cannot answer, plus one optional. */
  salaryMin: string;
  salaryMax: string;
  salaryBasis: string;
  workModePref: string[];
  availabilityBucket: string;
  availabilityDate: string;
  skillRatings: Record<string, number>;
  workStyle: string;
  motivationReason: string;
  motivationOther: string;
  consent: boolean;
}
type FieldErrors = Partial<Record<keyof FormData, string>>;

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#4f46e5]">{label}</p>
      <div className="mt-2 h-px bg-border" />
    </div>
  );
}

function FieldLabel({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1 flex-wrap">
      {children}
      {required && <span className="text-destructive text-xs leading-none">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1.5">
      <AlertCircle className="w-3 h-3 shrink-0" />{msg}
    </p>
  );
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-3">{children}</p>
  );
}

const baseCls = "h-10 rounded-md border text-sm transition-all outline-none focus:ring-2 focus:ring-[#4f46e5]/25 focus:border-[#4f46e5]";
const inputCls = (err?: string) => cn(baseCls, "w-full px-3", err ? "border-destructive bg-red-50" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)] bg-white");
const textareaCls = "rounded-md border border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)] focus:ring-2 focus:ring-[#4f46e5]/25 focus:border-[#4f46e5] text-sm transition-all outline-none w-full px-3 py-2 bg-white resize-none";

interface JobPosting {
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
  must_have_skills: string[];
  nice_to_have_skills: string[];
  description: string | null;
  key_responsibilities: string | null;
  requirements: string | null;
  nice_to_have_qualifications: string | null;
  status: string;
  posted_at: string | null;
  expires_at: string | null;
}

/** How the URL resolved to a job — decides what the page renders. */
type Resolution = "loading" | "ok" | "closed" | "list" | "notfound" | "error";

/** A previous submission by this browser for the current job → form opens in edit mode. */
interface ExistingApplication {
  ref: StoredApplicationRef;
  answers: ScreeningAnswers;
  resumeFilename: string | null;
  submittedAt: string | null;
}

/**
 * One application per candidate per job: if this browser already submitted to
 * `jobId` (tracked in localStorage), load that application so the form can
 * pre-fill and update it instead of inserting a duplicate.
 */
async function loadExistingApplication(jobId: string): Promise<ExistingApplication | null> {
  const ref = readStoredApplication(jobId);
  if (!ref) return null;

  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, job_posting_id, candidate_uuid, resume_id, submitted_at, ' +
      'expected_salary_min, expected_salary_max, salary_basis, work_mode_pref, ' +
      'availability_bucket, availability_date, skill_ratings, motivation_reason, ' +
      'motivation_other, work_style, consent_data_sharing, resumes(filename)'
    )
    .eq('id', ref.applicationId)
    .maybeSingle();

  if (error) {
    // Transient fetch problem: keep the stored ref, fall back to a fresh form.
    console.error('Failed to load previous application:', error);
    return null;
  }
  // supabase-js cannot infer types from a concatenated select string.
  const row = data as unknown as Record<string, unknown> | null;
  if (!row || row.job_posting_id !== jobId || row.candidate_uuid !== ref.candidateUuid) {
    // The application was removed (or the ref is corrupt) — forget it.
    clearStoredApplication(jobId);
    return null;
  }

  const resumeRel = row.resumes as { filename?: string } | { filename?: string }[] | null;
  const resumeFilename =
    (Array.isArray(resumeRel) ? resumeRel[0]?.filename : resumeRel?.filename) ?? null;

  return {
    ref,
    answers: screeningAnswersFromRow(row),
    resumeFilename,
    submittedAt: (row.submitted_at as string | null) ?? ref.submittedAt ?? null,
  };
}

const isExpired = (job: Pick<JobPosting, "expires_at">) =>
  !!job.expires_at && new Date(job.expires_at).getTime() < Date.now();

function ChoiceGroup({
  options, value, onChange, multi = false, columns = 1, error,
}: {
  options: Choice[];
  value: string | string[];
  onChange: (v: string & string[]) => void;
  multi?: boolean;
  columns?: number;
  error?: string;
}) {
  const isOn = (v: string) => (multi ? (value as string[]).includes(v) : value === v);

  const pick = (v: string) => {
    if (!multi) {
      onChange(v as string & string[]);
      return;
    }
    const cur = value as string[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange(next as string & string[]);
  };

  return (
    <>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {options.map((o) => {
          const on = isOn(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              aria-pressed={on}
              className="flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-all outline-none focus:ring-2 focus:ring-[#4f46e5]/25"
              style={{
                borderColor: on ? D.blue : error ? D.red : D.line,
                background: on ? D.blueSoft : D.canvas,
                color: on ? D.ink : D.sub,
              }}
            >
              <span
                className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center border transition-all"
                style={{
                  borderRadius: multi ? 4 : 999,
                  borderColor: on ? D.blue : D.dim,
                  background: on ? D.blue : "transparent",
                }}
              >
                {on && <Check size={11} strokeWidth={3} color="#fff" />}
              </span>
              <span className="min-w-0">
                <span className="block font-medium leading-snug">{o.label}</span>
                {o.hint && <span className="mt-0.5 block text-xs" style={{ color: D.muted }}>{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <FieldError msg={error} />
    </>
  );
}

/** 1–5 self-rating for one skill. Click the same number again to clear it. */
function RatingScale({ skill, value, onChange }: {
  skill: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5" style={{ borderBottom: `1px solid ${D.lineSoft}` }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: D.ink }}>{skill}</p>
        <p className="text-xs" style={{ color: D.muted, minHeight: 16 }}>
          {value ? RATING_HINTS[value - 1] : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={skill}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value >= n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(value === n ? 0 : n)}
              className="h-8 w-8 rounded-md border text-xs font-semibold transition-all"
              style={{
                borderColor: on ? D.blue : D.line,
                background: on ? D.blue : D.canvas,
                color: on ? "#fff" : D.dim,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConsentGate({ checked, onChange, jobTitle, error }: {
  checked: boolean;
  onChange: (b: boolean) => void;
  jobTitle: string;
  error?: string;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: checked ? D.blue : error ? D.red : D.line,
        background: checked ? D.blueSoft : D.surface,
      }}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#1B62F0]"
        />
        <span className="text-sm leading-relaxed" style={{ color: D.sub }}>
          I agree that <strong style={{ color: D.ink }}>SmartATS</strong> may store and process my CV
          and the answers above — including public data from the GitHub and LinkedIn profiles I
          provided — to assess my fit for the{" "}
          <strong style={{ color: D.ink }}>{jobTitle}</strong> position. I can request deletion of my
          data at any time.
        </span>
      </label>
      <FieldError msg={error} />
    </div>
  );
}

function ResumeUploader({ file, onChange, error }: { file: File | null; onChange: (f: File | null) => void; error?: string }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onChange(f);
  }, [onChange]);

  return (
    <div className="mb-6">
      <FieldLabel required>Resume / CV</FieldLabel>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
      {file ? (
        <div className="flex items-center gap-3 p-3 rounded-md border border-[#4f46e5]/30 bg-[#f5f3ff]">
          <div className="w-9 h-9 rounded-lg bg-[#4f46e5]/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-[#4f46e5]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · PDF</p>
          </div>
          <button type="button" onClick={() => { onChange(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={handleDrop} onClick={() => fileRef.current?.click()}
          className={cn(
            "flex items-center gap-4 rounded-md border-2 border-dashed px-5 py-5 cursor-pointer transition-all",
            drag ? "border-[#4f46e5] bg-[#f5f3ff]" : error
              ? "border-destructive bg-red-50"
              : "border-[rgba(15,17,23,0.15)] bg-[#fafafa] hover:border-[#4f46e5]/50 hover:bg-[#faf9ff]"
          )}>
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            drag ? "bg-[#4f46e5]/10" : "bg-white border border-border shadow-sm")}>
            <Upload className={cn("w-4 h-4", drag ? "text-[#4f46e5]" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{drag ? "Release to upload" : "Attach resume / CV"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF only · Max 10 MB · <span className="text-[#4f46e5]">Browse files</span></p>
          </div>
        </div>
      )}
      <FieldError msg={error} />
    </div>
  );
}

function LoadingScreen({ updating = false }: { updating?: boolean }) {
  if (updating) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="w-14 h-14 rounded-2xl bg-[#4f46e5]/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#4f46e5] animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Saving your changes…</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Updating the answers on your application.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-6">
      <div className="w-14 h-14 rounded-2xl bg-[#4f46e5]/10 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#4f46e5] animate-spin" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">Processing your application…</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Enriching your profile with public GitHub and LinkedIn data.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-60">
        {["Parsing resume", "Fetching GitHub activity", "Scanning LinkedIn profile"].map((step, i) => (
          <div key={step} className="flex items-center gap-2.5">
            <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0",
              i === 0 ? "bg-emerald-500" : i === 1 ? "bg-[#4f46e5] animate-pulse" : "bg-[rgba(15,17,23,0.1)]")}>
              {i === 0 && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <span className={cn("text-xs", i <= 1 ? "text-foreground" : "text-muted-foreground")}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsPanel({ jobTitle, updated, onReset }: { jobTitle: string; updated: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">Thank you!</p>
        <p className="text-muted-foreground mt-1">
          {updated ? (
            <>Your application for <span className="font-medium text-foreground">{jobTitle}</span> has
            been updated. We will be in touch at the email address on your CV.</>
          ) : (
            <>Your application for <span className="font-medium text-foreground">{jobTitle}</span> has
            been submitted. We will be in touch at the email address on your CV.</>
          )}
        </p>
      </div>
      <button onClick={onReset} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
        Review or edit your application
      </button>
    </div>
  );
}

function ApplicationForm({ job, onSubmit, existing }: {
  job: JobPosting;
  onSubmit: (d: FormData) => void;
  existing?: ExistingApplication | null;
}) {
  const editing = !!existing;
  const [form, setForm] = useState<FormData>({
    resume: null,
    salaryMin: "", salaryMax: "", salaryBasis: "gross",
    workModePref: [], availabilityBucket: "", availabilityDate: "",
    skillRatings: {}, workStyle: "",
    motivationReason: "", motivationOther: "", consent: false,
    ...(existing?.answers ?? {}),
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const ratedSkills = React.useMemo(() => pickRatedSkills(job), [job]);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    // In edit mode the CV from the original submission is kept, so no upload.
    if (!editing && !form.resume) e.resume = "Please upload your CV";
    Object.assign(e, validateScreening(form, ratedSkills));
    return e;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.querySelector("[data-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit(form);
  };

  const ratedCount = ratedSkills.filter((s) => form.skillRatings[s]).length;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-9">

      {/* Returning candidate — one application per job, so this is an edit */}
      {editing && (
        <div
          className="flex items-start gap-2.5 rounded-md border px-4 py-3"
          style={{ borderColor: D.blue, background: D.blueSoft }}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: D.blue }} />
          <p className="text-sm leading-relaxed" style={{ color: D.sub }}>
            You already applied for this position
            {existing?.submittedAt && (
              <> on <strong style={{ color: D.ink }}>
                {new Date(existing.submittedAt).toLocaleDateString()}
              </strong></>
            )}. Your previous answers are pre-filled below — change anything you like and save.
          </p>
        </div>
      )}

      {/* CV — everything we can read off it, we do not ask for */}
      {editing ? (
        <section>
          <FieldLabel>Resume / CV</FieldLabel>
          <div className="flex items-center gap-3 p-3 rounded-md border border-[#4f46e5]/30 bg-[#f5f3ff]">
            <div className="w-9 h-9 rounded-lg bg-[#4f46e5]/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#4f46e5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {existing?.resumeFilename || "resume.pdf"}
              </p>
              <p className="text-xs text-muted-foreground">Submitted with your original application</p>
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: D.muted }}>
            Your CV on file is kept. To submit a different CV, please contact the hiring team.
          </p>
        </section>
      ) : (
        <section data-error={!!errors.resume}>
          <ResumeUploader file={form.resume} onChange={(f) => set("resume", f)} error={errors.resume} />
          <p className="-mt-3 text-xs" style={{ color: D.muted }}>
            We read your name, contact details and links straight from the CV — no need to retype them.
          </p>
        </section>
      )}

      <div className="h-px" style={{ background: D.line }} />

      {/* 1 — Salary */}
      <section data-error={!!errors.salaryMax}>
        <FieldLabel required>Expected monthly salary</FieldLabel>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              inputMode="numeric" placeholder="15,000,000" value={form.salaryMin}
              onChange={(e) => set("salaryMin", formatVnd(e.target.value))}
              className={cn(inputCls(errors.salaryMax), "pr-11")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium" style={{ color: D.dim }}>VND</span>
          </div>
          <span className="text-sm" style={{ color: D.muted }}>to</span>
          <div className="relative flex-1">
            <input
              inputMode="numeric" placeholder="20,000,000" value={form.salaryMax}
              onChange={(e) => set("salaryMax", formatVnd(e.target.value))}
              className={cn(inputCls(errors.salaryMax), "pr-11")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium" style={{ color: D.dim }}>VND</span>
          </div>
        </div>
        <FieldError msg={errors.salaryMax} />
        <div className="mt-2.5 max-w-[200px]">
          <ChoiceGroup
            options={SALARY_BASIS_OPTIONS}
            value={form.salaryBasis}
            onChange={(v) => set("salaryBasis", v)}
            columns={2}
          />
        </div>
      </section>

      {/* 2 — Working arrangement */}
      <section data-error={!!errors.workModePref}>
        <FieldLabel required>Preferred working arrangement</FieldLabel>
        <MicroLabel>Select all that work for you</MicroLabel>
        <ChoiceGroup
          options={WORK_MODE_OPTIONS}
          value={form.workModePref}
          onChange={(v) => set("workModePref", v)}
          multi columns={3}
          error={errors.workModePref}
        />
      </section>

      {/* 3 — Availability */}
      <section data-error={!!errors.availabilityBucket}>
        <FieldLabel required>When can you start?</FieldLabel>
        <ChoiceGroup
          options={AVAILABILITY_OPTIONS}
          value={form.availabilityBucket}
          onChange={(v) => set("availabilityBucket", v)}
          columns={4}
          error={errors.availabilityBucket}
        />
        {form.availabilityBucket === "other" && (
          <div className="mt-2.5 max-w-[220px]">
            <input
              type="date" value={form.availabilityDate}
              onChange={(e) => set("availabilityDate", e.target.value)}
              className={inputCls(errors.availabilityDate)}
            />
            <FieldError msg={errors.availabilityDate} />
          </div>
        )}
      </section>

      {/* 4 — Skill self-rating, driven by the job itself */}
      {ratedSkills.length > 0 && (
        <section data-error={!!errors.skillRatings}>
          <FieldLabel required>How strong are you on this role&apos;s skills?</FieldLabel>
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel>1 = just starting · 5 = expert</MicroLabel>
            <span className="text-[11px] font-medium" style={{ color: ratedCount === ratedSkills.length ? D.mint : D.dim }}>
              {ratedCount} / {ratedSkills.length}
            </span>
          </div>
          <div
            className="rounded-lg border px-4"
            style={{ borderColor: errors.skillRatings ? D.red : D.line, background: D.canvas }}
          >
            {ratedSkills.map((skill) => (
              <RatingScale
                key={skill}
                skill={skill}
                value={form.skillRatings[skill] ?? 0}
                onChange={(n) => set("skillRatings", { ...form.skillRatings, [skill]: n })}
              />
            ))}
          </div>
          <FieldError msg={errors.skillRatings} />
        </section>
      )}

      {/* 5 — Working style */}
      <section data-error={!!errors.workStyle}>
        <FieldLabel required>How do you prefer to work?</FieldLabel>
        <ChoiceGroup
          options={WORK_STYLE_OPTIONS}
          value={form.workStyle}
          onChange={(v) => set("workStyle", v)}
          columns={3}
          error={errors.workStyle}
        />
      </section>

      {/* Optional — free text for downstream NLP, never blocks submit */}
      <section>
        <FieldLabel htmlFor="motivationOther">
          What is driving your move?{" "}
          <span className="font-normal" style={{ color: D.muted }}>(Optional)</span>
        </FieldLabel>
        <ChoiceGroup
          options={MOTIVATION_OPTIONS}
          value={form.motivationReason}
          onChange={(v) => set("motivationReason", v)}
          columns={4}
        />
        <textarea
          id="motivationOther" rows={3} placeholder="Anything you would like to add"
          value={form.motivationOther}
          onChange={(e) => set("motivationOther", e.target.value)}
          className={cn(textareaCls, "mt-2.5")}
        />
      </section>

      <div className="h-px" style={{ background: D.line }} />

      <section data-error={!!errors.consent}>
        <ConsentGate
          checked={form.consent}
          onChange={(b) => set("consent", b)}
          jobTitle={job.job_title}
          error={errors.consent}
        />
      </section>

      <div>
        <button
          type="submit" disabled={!form.consent}
          className="w-full h-11 rounded-md bg-[#4f46e5] text-white font-semibold text-sm
            hover:bg-[#4338ca] active:scale-[0.99] transition-all shadow-sm
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#4f46e5] disabled:active:scale-100
            focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2"
        >
          {editing ? "Update Application" : "Submit Application"}
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-center" style={{ color: D.muted }}>
          We may use AI tools to support parts of the hiring process, such as reviewing applications
          and analysing CVs. These tools assist our recruitment team but do not replace human
          judgment — final hiring decisions are made by people.
        </p>

        <p className="mt-3 text-[11px] text-center" style={{ color: D.dim }}>
          Jobs powered by <span className="font-semibold" style={{ color: D.sub }}>SmartATS</span>
        </p>
      </div>
    </form>
  );
}

function StatusPanel({
  tone, icon: Icon, title, children,
}: {
  tone: "amber" | "muted";
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  const accent = tone === "amber" ? D.amber : D.muted;
  return (
    <div className="rounded-xl border bg-white p-8 text-center shadow-sm" style={{ borderColor: D.line }}>
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: tone === "amber" ? "rgba(217,119,6,0.10)" : D.surface }}
      >
        <Icon size={22} strokeWidth={1.8} color={accent} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight" style={{ color: D.ink }}>{title}</h2>
      <div className="mx-auto mt-2 max-w-[420px] text-sm leading-relaxed" style={{ color: D.muted }}>
        {children}
      </div>
    </div>
  );
}

function OpenJobsPanel({ jobs, heading, note }: { jobs: JobPosting[]; heading: string; note: string }) {
  const router = useRouter();

  if (jobs.length === 0) {
    return (
      <StatusPanel tone="muted" icon={Briefcase} title="No open positions right now">
        There are no roles accepting applications at the moment. Please check back later.
      </StatusPanel>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: D.ink }}>{heading}</h2>
        <p className="mt-1 text-sm" style={{ color: D.muted }}>{note}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {jobs.map((job) => (
          <button
            key={job.id}
            type="button"
            onClick={() => router.push(buildJobPath(job.id, job.job_title))}
            className="group flex items-center gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
            style={{ borderColor: D.line }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: D.ink }}>{job.job_title}</p>
              <p className="mt-1 truncate text-xs" style={{ color: D.muted }}>
                {[job.location, job.department, job.employment_type, job.work_mode]
                  .filter(Boolean).join("  ·  ") || "Details inside"}
              </p>
            </div>
            <ExternalLink size={16} strokeWidth={1.8} color={D.dim}
              className="shrink-0 transition-colors group-hover:text-[#1B62F0]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ job }: { job: JobPosting | null }) {
  return (
    <aside className="w-[320px] shrink-0 flex flex-col bg-white border-r border-border overflow-y-auto">
      <div className="px-7 pt-7 pb-6 border-b border-border">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#4f46e5] flex items-center justify-center">
            <span className="text-white font-bold text-[10px] tracking-tight">CP</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Career Page</span>
          {job && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {job.status === 'PUBLISHED' ? 'Open' : job.status}
            </span>
          )}
        </div>
        <h1 className="text-base font-semibold text-foreground leading-snug tracking-tight mb-2">
          {job?.job_title || 'Position'}
        </h1>
        <p className="text-xs text-muted-foreground">{job?.location || 'Location'}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {[job?.department, job?.employment_type, job?.work_mode].filter(Boolean).map((tag) => (
            <span key={tag} className="text-[11px] text-muted-foreground bg-[#f4f4f6] rounded px-2 py-0.5 border border-border">{tag}</span>
          ))}
        </div>
      </div>
      <div className="px-7 py-6 flex-1 flex flex-col gap-6">
        {job?.must_have_skills && job.must_have_skills.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">Must-Have Skills</p>
            <ul className="flex flex-col gap-1.5">
              {job.must_have_skills.map((skill) => (
                <li key={skill} className="flex items-start gap-2">
                  <div className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#4f46e5]/30 shrink-0" />
                  <span className="text-xs text-muted-foreground leading-snug">{skill}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {job?.nice_to_have_skills && job.nice_to_have_skills.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">Nice-to-Have Skills</p>
            <ul className="flex flex-col gap-1.5">
              {job.nice_to_have_skills.map((skill) => (
                <li key={skill} className="flex items-start gap-2">
                  <div className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#4f46e5]/30 shrink-0" />
                  <span className="text-xs text-muted-foreground leading-snug">{skill}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {job?.requirements && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">Requirements</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{job.requirements}</p>
          </div>
        )}
      </div>
      <div className="px-7 py-5 border-t border-border bg-[#fafafa]">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          After applying, your public GitHub and LinkedIn profiles may be enriched to give the hiring team a fuller picture.
        </p>
      </div>
    </aside>
  );
}

export default function CareersPortalPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug ? (Array.isArray(params.slug) ? params.slug[0] : params.slug) : null;
  const jobId = parseJobId(slug);
  const { isAuthenticated } = useAuth();

  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [openJobs, setOpenJobs] = useState<JobPosting[]>([]);
  const [resolution, setResolution] = useState<Resolution>("loading");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  // Set when this browser already applied to the selected job → edit mode.
  const [existingApp, setExistingApp] = useState<ExistingApplication | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    const listOpenJobs = async () => {
      const { data, error: fetchError } = await supabase
        .from('jobs_posting')
        .select('*')
        .eq('status', 'PUBLISHED')
        .order('posted_at', { ascending: false, nullsFirst: false });
      if (fetchError) throw fetchError;
      return ((data ?? []) as JobPosting[]).filter((j) => !isExpired(j));
    };

    const loadJobData = async () => {
      setLoading(true);
      try {
        // 1. Canonical link — /careers/<title-slug>-<uuid>. The UUID is authoritative,
        //    so a renamed job keeps working and a title clash can never misroute a CV.
        if (jobId) {
          const { data, error: fetchError } = await supabase
            .from('jobs_posting')
            .select('*')
            .eq('id', jobId)
            .maybeSingle();
          if (fetchError) throw fetchError;

          if (!data) {
            setResolution('notfound');
            return;
          }
          const job = data as JobPosting;
          setSelectedJob(job);
          const open = job.status === 'PUBLISHED' && !isExpired(job);
          setResolution(open ? 'ok' : 'closed');
          if (open) setExistingApp(await loadExistingApplication(job.id));
          return;
        }

        // 2. Legacy title-only link. Accept it only when it points at exactly one
        //    open job — otherwise we would be guessing which job the CV belongs to.
        if (slug) {
          const decoded = decodeURIComponent(slug);
          const { data, error: fetchError } = await supabase
            .from('jobs_posting')
            .select('*')
            .eq('status', 'PUBLISHED')
            .ilike('job_title', decoded);
          if (fetchError) throw fetchError;

          const open = ((data ?? []) as JobPosting[]).filter((j) => !isExpired(j));
          if (open.length === 1) {
            setSelectedJob(open[0]);
            setResolution('ok');
            setExistingApp(await loadExistingApplication(open[0].id));
            return;
          }
          setOpenJobs(await listOpenJobs());
          setResolution(open.length === 0 ? 'notfound' : 'list');
          return;
        }

        // 3. Bare /careers — never auto-select a job. Let the candidate choose.
        setOpenJobs(await listOpenJobs());
        setResolution('list');
      } catch (err) {
        console.error('Failed to load job data:', err);
        setError('Failed to load job postings');
        setResolution('error');
      } finally {
        setLoading(false);
      }
    };
    loadJobData();
  }, [slug, jobId]);

  /** Edit mode: the candidate already applied — update their answers in place. */
  const handleUpdate = async (form: FormData) => {
    if (!selectedJob || !existingApp) return;
    setSubmitting(true);
    setError(null);
    setPhase("loading");

    try {
      const { error: applicationError } = await supabase
        .from('applications')
        .update(buildScreeningPayload(form, new Date().toISOString()))
        .eq('id', existingApp.ref.applicationId);

      if (applicationError) {
        console.error('application update error:', applicationError);
        throw new Error(applicationError.message || 'Failed to update application');
      }

      // Keep the headline figure on the candidate row in sync (same as create).
      const { error: candidateError } = await supabase
        .from('candidates')
        .update({ salary_expectation: toAmount(form.salaryMax) ?? toAmount(form.salaryMin) })
        .eq('uuid', existingApp.ref.candidateUuid);
      if (candidateError) {
        // Reporting-only field — the application itself was saved, so don't fail.
        console.error('candidate update error:', candidateError);
      }

      const { resume: _resume, ...answers } = form;
      setExistingApp({ ...existingApp, answers });
      setJustUpdated(true);
      setSubmitting(false);
      setPhase("results");
    } catch (err) {
      console.error('Application update failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to update application');
      setSubmitting(false);
      setPhase("form");
    }
  };

  const handleSubmit = async (form: FormData) => {
    if (!selectedJob) {
      setError('No job selected for this application.');
      return;
    }
    // One application per job: a returning candidate edits instead of re-submitting.
    if (existingApp) {
      await handleUpdate(form);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // Name, email, phone and social links are extracted from the CV by the
      // ingest pipeline, so the form does not collect them.
      const formDataUpload = new FormData();
      if (form.resume) formDataUpload.append('file', form.resume);
      formDataUpload.append('job_id', selectedJob.id);
      formDataUpload.append('job_title', selectedJob.job_title);

      setPhase("loading");

      const ingestResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/ingest`, {
        method: 'POST',
        body: formDataUpload,
      });

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to upload CV');
      }

      const ingestData = await ingestResponse.json();
      const candidateUuid = ingestData.candidate_uuid;
      const storageUrl = ingestData.storage_url;

      if (!candidateUuid) {
        throw new Error('No candidate UUID returned from ingest API');
      }

      // Only what the CV cannot provide. The ingest pipeline fills in the rest.
      const { error: candidateError } = await supabase
        .from('candidates')
        .upsert({
          uuid: candidateUuid,
          // Headline figure for ABAC-governed reporting; the full range lives on
          // the application row, since expectations differ per role.
          salary_expectation: toAmount(form.salaryMax) ?? toAmount(form.salaryMin),
          cv_file_path: storageUrl || null,
        }, { onConflict: 'uuid' });

      if (candidateError) {
        console.error('candidate upsert error:', candidateError);
        throw new Error(candidateError.message || 'Failed to save candidate');
      }

      // Create resume record
      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .insert({
          candidate_uuid: candidateUuid,
          filename: form.resume?.name || 'resume.pdf',
          file_path: storageUrl || null,
        })
        .select('id')
        .single();

      if (resumeError) {
        console.error('resume insert error:', resumeError);
        throw new Error(resumeError.message || 'Failed to save resume');
      }

      // Create application record
      const { data: applicationData, error: applicationError } = await supabase
        .from('applications')
        .insert({
          candidate_uuid: candidateUuid,
          job_posting_id: selectedJob.id,
          resume_id: resumeData.id,
          ...buildScreeningPayload(form, new Date().toISOString()),
        })
        .select('id, submitted_at')
        .single();

      if (applicationError) {
        console.error('application insert error:', applicationError);
        throw new Error(applicationError.message || 'Failed to save application');
      }

      // Remember this submission so a return visit becomes an edit, not a duplicate.
      const submittedAt = (applicationData.submitted_at as string | null) ?? new Date().toISOString();
      const ref: StoredApplicationRef = {
        applicationId: applicationData.id as string,
        candidateUuid,
        resumeId: resumeData.id as string,
        submittedAt,
      };
      writeStoredApplication(selectedJob.id, ref);
      const { resume: _resume, ...answers } = form;
      setExistingApp({
        ref,
        answers,
        resumeFilename: form.resume?.name ?? null,
        submittedAt,
      });
      setJustUpdated(false);

      setSubmitting(false);
      setPhase("results");

    } catch (err) {
      console.error('Application submission failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit application');
      setSubmitting(false);
      setPhase("form");
    }
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: D.bg }}>
        <Loader2 size={32} strokeWidth={2} color={D.blue} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fb]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Preview banner — internal only. Candidates reach this page with no
          session and must never see HR chrome. */}
      {isAuthenticated && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2 bg-[#4f46e5] text-white text-xs shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-medium">Candidate Portal Preview</span>
            <span className="opacity-60">— viewing as a job applicant</span>
          </div>
          <button onClick={() => router.push('/')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors font-medium">
            ← Back to HR Dashboard
          </button>
        </div>
      )}

      {/* Topnav */}
      <header className={cn(
        "h-12 bg-white border-b border-border flex items-center px-7 gap-3 shrink-0 z-20",
        isAuthenticated && "mt-8",
      )}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#4f46e5] flex items-center justify-center">
            <span className="text-white font-bold text-[9px] tracking-tight">CP</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Career Page</span>
        </div>
        <div className="w-px h-3.5 bg-border mx-1" />
        <span className="text-sm text-muted-foreground">{selectedJob?.job_title || "Careers"}</span>
        <div className="ml-auto">
          <a href="#" className="text-sm text-[#4f46e5] hover:underline font-medium">Go to Home Page</a>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar job={selectedJob} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[740px] mx-auto px-10 py-9">

            {error && (
              <div className="mb-6 flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {resolution === "list" && (
              <OpenJobsPanel
                jobs={openJobs}
                heading="Open positions"
                note="Select the role you want to apply for. Your CV is attached to that role only."
              />
            )}

            {resolution === "closed" && (
              <StatusPanel tone="amber" icon={Clock} title="Applications are closed">
                <strong style={{ color: D.ink }}>{selectedJob?.job_title}</strong> is no longer
                accepting applications. Browse our other open roles at{" "}
                <a href="/careers" className="font-medium" style={{ color: D.blue }}>/careers</a>.
              </StatusPanel>
            )}

            {resolution === "notfound" && (
              <StatusPanel tone="muted" icon={Search} title="Position not found">
                This link may be outdated or the posting was removed. See our{" "}
                <a href="/careers" className="font-medium" style={{ color: D.blue }}>open positions</a>.
              </StatusPanel>
            )}

            {resolution === "ok" && selectedJob && (
              <>
                {phase === "form" && (
                  <>
                    <div className="mb-7">
                      <h2 className="text-xl font-semibold text-foreground tracking-tight">
                        {selectedJob.job_title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedJob.location || "Location"} &nbsp;·&nbsp; {selectedJob.department || "Department"} / {selectedJob.employment_type || "Type"} / {selectedJob.work_mode || "On-site"}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
                      <ApplicationForm
                        key={existingApp?.ref.applicationId ?? "new"}
                        job={selectedJob}
                        onSubmit={handleSubmit}
                        existing={existingApp}
                      />
                    </div>
                  </>
                )}

                {phase === "loading" && <LoadingScreen updating={!!existingApp} />}

                {phase === "results" && (
                  <ResultsPanel
                    jobTitle={selectedJob.job_title}
                    updated={justUpdated}
                    onReset={() => setPhase("form")}
                  />
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
