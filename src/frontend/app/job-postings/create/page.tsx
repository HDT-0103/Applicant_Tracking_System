"use client";

import React, { useState, useEffect, useRef, Suspense, KeyboardEvent } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from "../../../components/AppHeader";
import { ReviewPanelPicker } from "../../../components/ReviewPanelPicker";
import {
  getJobPosting,
  saveJobPosting,
  setJobPostingStatus,
} from "../../../services/catalogService";
import { LeftSidebar } from "../../../components/LeftSidebar";
import { D } from "../../../lib/shared";
import {
  Plus,
  X,
  ExternalLink,
  Check,
  ChevronDown,
  Save,
  Sparkles,
  Building2,
  MapPin,
  Users,
  Briefcase,
  Target,
  Eye,
  Globe,
  ArrowRight,
  CheckCircle2,
  Clock,
  Tag,
  Layers,
  Pencil,
  Bold,
  Italic,
  List,
  AlignLeft,
  Code2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { buildJobUrl } from "../../../lib/jobUrl";
import { ShareLinkBox } from "../../../components/ShareLinkBox";
import { useT } from "@/lib/i18n";

interface JDState {
  title: string;
  department: string;
  location: string;
  workMode: string;
  seniority: string;
  targetApplicants: string;
  employmentType: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  overview: string;
  responsibilities: string;
  requirements: string;
  niceToHaveQuals: string;
  salaryMin: string;
  salaryMax: string;
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function StepIndicator({ 
  currentStep, 
  onSelectStep 
}: { 
  currentStep: number; 
  onSelectStep: (step: number) => void;
}) {
  const t = useT();
  const steps = [
    { n: 1, label: t("jobs.wizard.step1") },
    { n: 2, label: t("jobs.wizard.step2") },
    { n: 3, label: t("jobs.wizard.step3") },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isActive = step.n === currentStep;
        const isDone = step.n < currentStep;
        return (
          <div key={step.n} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelectStep(step.n)}
              className="flex items-center gap-2 hover:opacity-80 transition-all cursor-pointer text-left py-1 px-1.5 rounded-lg hover:bg-[rgba(15,17,23,0.04)]"
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all",
                  isActive
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : isDone
                    ? "bg-primary text-white"
                    : "bg-[rgba(15,17,23,0.08)] text-muted-foreground",
                )}
              >
                {isDone ? <Check className="w-3 h-3" /> : step.n}
              </div>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isActive ? "text-primary font-semibold" : isDone ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex items-center mx-3">
                <div className={cn("h-px w-8", isDone ? "bg-primary/40" : "bg-border")} />
                <ChevronRight className={cn("w-3.5 h-3.5 -ml-1", isDone ? "text-primary/40" : "text-border")} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TagInput({
  label,
  tags,
  onAdd,
  onRemove,
  variant,
  placeholder,
}: {
  label: string;
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  variant: "primary" | "outline";
  placeholder: string;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onAdd(val);
      setInput("");
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !input && tags.length) {
      onRemove(tags[tags.length - 1]);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="ml-auto text-[11px] text-muted-foreground">{t("jobs.wizard.tags.added", { n: tags.length })}</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="h-9 text-sm border-[rgba(15,17,23,0.15)] focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-md px-3 flex-1 outline-none transition-all"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!input.trim()}
          className={cn(
            "h-9 w-9 rounded-md flex items-center justify-center shrink-0 transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            variant === "primary"
              ? "bg-primary text-white hover:bg-primary-hover"
              : "border border-[rgba(15,17,23,0.15)] bg-white text-foreground hover:bg-[#f4f5f7] hover:border-[rgba(15,17,23,0.3)]",
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground italic">{t("jobs.wizard.tags.empty")}</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              variant === "primary"
                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                : "bg-white text-foreground border border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]",
            )}
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className={cn(
                "rounded-sm p-0.5 hover:bg-black/10 transition-colors",
                variant === "primary" ? "text-primary" : "text-muted-foreground",
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function RichTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  required?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {required && <span className="text-destructive text-xs">*</span>}
        <span className="ml-auto text-[11px] text-muted-foreground">{t("jobs.wizard.chars", { n: value.length })}</span>
      </div>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border border-b-0 border-[rgba(15,17,23,0.15)] rounded-t-md bg-[#f8f9fb]">
        {[
          { id: "bold", icon: Bold, tip: t("jobs.wizard.fmt.bold") },
          { id: "italic", icon: Italic, tip: t("jobs.wizard.fmt.italic") },
          { id: "code", icon: Code2, tip: t("jobs.wizard.fmt.code") },
          { id: "list", icon: List, tip: t("jobs.wizard.fmt.list") },
          { id: "paragraph", icon: AlignLeft, tip: t("jobs.wizard.fmt.paragraph") },
        ].map(({ id: tipId, icon: Icon, tip }) => (
          <button
            key={tipId}
            type="button"
            title={tip}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-[rgba(15,17,23,0.06)] transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-mono">Markdown</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-t-none border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.25)] focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm resize-none transition-all outline-none font-mono text-[13px] leading-relaxed w-full px-3 py-2 bg-white"
      />
    </div>
  );
}

function PreviewCard({ jd }: { jd: JDState }) {
  const t = useT();
  const title = jd.title || t("jobs.wizard.preview.titlePlaceholder");
  const dept = jd.department || t("jobs.wizard.preview.deptPlaceholder");
  const loc = jd.location || t("jobs.wizard.preview.locPlaceholder");
  const mode = jd.workMode || t("jobs.wizard.preview.modePlaceholder");
  const seniority = jd.seniority || "Mid";
  const allMustHave = jd.mustHaveSkills.length > 0 ? jd.mustHaveSkills : [];
  const allNiceToHave = jd.niceToHaveSkills.length > 0 ? jd.niceToHaveSkills : [];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-primary to-[#6d28d9] px-5 py-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">GC</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("jobs.wizard.preview.open")}
          </span>
        </div>
        <h3 className="text-base font-semibold text-white leading-snug mb-1">{title}</h3>
        <p className="text-xs text-white/70">GeoComply · {dept}</p>
      </div>

      <div className="px-5 py-3.5 border-b border-border flex flex-wrap gap-3">
        {[
          { icon: MapPin, text: loc },
          { icon: Briefcase, text: mode },
          { icon: Layers, text: seniority },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="w-3.5 h-3.5 text-primary/60" />
            {text}
          </div>
        ))}
      </div>

      <div className="px-5 py-4 flex flex-col gap-3.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {t("jobs.wizard.preview.mustHave")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMustHave.slice(0, 6).map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">
                {s}
              </span>
            ))}
            {allMustHave.length > 6 && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f4f5f7] text-muted-foreground border border-border font-medium">
                {t("jobs.wizard.preview.more", { n: allMustHave.length - 6 })}
              </span>
            )}
          </div>
        </div>
        {allNiceToHave.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t("jobs.wizard.preview.niceToHave")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allNiceToHave.slice(0, 5).map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-white text-foreground border border-border font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        <button
          type="button"
          className="w-full h-9 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
        >
          {t("jobs.wizard.preview.apply")}
        </button>
      </div>
    </div>
  );
}

function PublishModal({
  open,
  onClose,
  jobTitle,
  shareUrl,
}: {
  open: boolean;
  onClose: () => void;
  jobTitle: string;
  shareUrl: string | null;
}) {
  const t = useT();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-w-[480px] w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-br from-primary to-[#6d28d9] px-8 py-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">{t("jobs.wizard.publish.title")}</h2>
            <p className="text-sm text-white/70 mt-1.5">
              <span className="font-medium text-white/90">{jobTitle || t("jobs.wizard.publish.yourPosition")}</span> {t("jobs.wizard.publish.live")}
            </p>
          </div>
        </div>

        <div className="px-8 py-6 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Globe, label: t("jobs.wizard.publish.badge.live"), color: "emerald" },
              { icon: Users, label: t("jobs.wizard.publish.badge.apps"), color: "blue" },
              { icon: Sparkles, label: t("jobs.wizard.publish.badge.ai"), color: "violet" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg py-3 px-2 border text-center",
                color === "emerald" && "bg-emerald-50 border-emerald-200",
                color === "blue" && "bg-blue-50 border-blue-200",
                color === "violet" && "bg-violet-50 border-violet-200",
              )}>
                <Icon className={cn("w-4 h-4",
                  color === "emerald" && "text-emerald-600",
                  color === "blue" && "text-blue-600",
                  color === "violet" && "text-violet-600",
                )} />
                <span className={cn("text-[11px] font-medium leading-tight",
                  color === "emerald" && "text-emerald-700",
                  color === "blue" && "text-blue-700",
                  color === "violet" && "text-violet-700",
                )}>{label}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed text-center">
            {t("jobs.wizard.publish.body")}
          </p>

          {shareUrl && <ShareLinkBox url={shareUrl} />}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 rounded-lg border border-border bg-white text-sm font-medium
                text-foreground hover:bg-[#f4f5f7] transition-colors"
            >
              {t("jobs.wizard.publish.continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateJobPostingForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams.get('id');

  const [jd, setJD] = useState<JDState>({
    title: "",
    department: "",
    location: "",
    workMode: "",
    seniority: "",
    targetApplicants: "",
    employmentType: "",
    mustHaveSkills: [],
    niceToHaveSkills: [],
    overview: "",
    responsibilities: "",
    requirements: "",
    niceToHaveQuals: "",
    salaryMin: "",
    salaryMax: "",
  });

  const [postingId, setPostingId] = useState<string | null>(null);
  /** Sĩ số hội đồng chấm. 0 = chưa mời ai, và tin không được đăng. */
  const [panelCount, setPanelCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savingError, setSavingError] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState<boolean>(!!editJobId);
  const headerTitleInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jdRef = useRef(jd);
  jdRef.current = jd;

  useEffect(() => {
    if (!editJobId) return;

    let isMounted = true;
    setPostingId(editJobId);
    setIsLoadingJob(true);

    const fetchExistingJob = async () => {
      try {
        const job = await getJobPosting(editJobId);

        if (job && isMounted) {
          setJD({
            title: job.job_title || "",
            department: job.department || "",
            location: job.location || "",
            workMode: job.work_mode || "",
            seniority: job.seniority_level || "",
            targetApplicants: job.target_openings ? String(job.target_openings) : "",
            employmentType: job.employment_type || "",
            mustHaveSkills: Array.isArray(job.must_have_skills) ? job.must_have_skills : [],
            niceToHaveSkills: Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills : [],
            overview: job.description || "",
            responsibilities: job.key_responsibilities || "",
            requirements: job.requirements || "",
            niceToHaveQuals: job.nice_to_have_qualifications || "",
            salaryMin: job.salary_min ? String(job.salary_min) : "",
            salaryMax: job.salary_max ? String(job.salary_max) : "",
          });
        }
      } catch (err) {
        console.error("Failed to load existing job posting:", err);
      } finally {
        if (isMounted) setIsLoadingJob(false);
      }
    };

    fetchExistingJob();

    return () => {
      isMounted = false;
    };
  }, [editJobId]);

  const saveToSupabase = async (status: 'DRAFT' | 'PUBLISHED') => {
    // Đăng tin mà chưa có hội đồng thì hồ sơ về sẽ nằm im: không tech lead nào
    // xem được, và ngưỡng 80% của 0 người là vô nghĩa. Chặn ở đây vì sai lầm
    // phát hiện lúc đăng tin rẻ hơn nhiều so với lúc ứng viên đã nộp.
    if (status === 'PUBLISHED' && panelCount === 0) {
      setSavingError(t("jobs.wizard.err.noPanel"));
      setSaveStatus("idle");
      setCurrentStep(3);
      return;
    }

    const data = jdRef.current;
    if (!data.title || !data.title.trim()) {
      setSavingError(t("jobs.wizard.err.titleRequired"));
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    setSavingError(null);

    try {
      // Qua backend: danh sách trường được lưu là CỐ ĐỊNH ở phía máy chủ.
      // Trước đây trình duyệt gửi payload thẳng vào PostgREST, nên client tự
      // quyết được cột nào bị ghi — kể cả `created_by` hay `status`.
      const saved = await saveJobPosting(
        {
          job_title: data.title.trim(),
          department: data.department || null,
          location: data.location || null,
          seniority_level: data.seniority || null,
          employment_type: data.employmentType || null,
          work_mode: data.workMode || null,
          target_openings: data.targetApplicants ? parseInt(data.targetApplicants, 10) : null,
          salary_min: data.salaryMin ? parseFloat(data.salaryMin) : null,
          salary_max: data.salaryMax ? parseFloat(data.salaryMax) : null,
          must_have_skills: data.mustHaveSkills,
          nice_to_have_skills: data.niceToHaveSkills,
          description: data.overview || null,
          key_responsibilities: data.responsibilities || null,
          requirements: data.requirements || null,
          nice_to_have_qualifications: data.niceToHaveQuals || null,
        },
        postingId,
      );
      if (!postingId && saved?.id) setPostingId(saved.id);

      // Đăng tin là bước RIÊNG: backend từ chối nếu chưa có hội đồng chấm.
      if (status === 'PUBLISHED') {
        await setJobPostingStatus(saved?.id ?? postingId!, 'PUBLISHED');
      }

      setSaveStatus("saved");
      if (status === 'PUBLISHED') {
        setShowPublishModal(true);
      }
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
      setSavingError(err instanceof Error ? err.message : t("jobs.wizard.err.saveFailed"));
      setSaveStatus("idle");
    }
  };

  const set = <K extends keyof JDState>(k: K, v: JDState[K]) => {
    setJD((prev) => ({ ...prev, [k]: v }));
    setSaveStatus("saving");
    setSavingError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToSupabase('DRAFT'), 1500);
  };

  const addMust = (v: string) => set("mustHaveSkills", [...jd.mustHaveSkills, v]);
  const removeMust = (v: string) => set("mustHaveSkills", jd.mustHaveSkills.filter((s) => s !== v));
  const addNice = (v: string) => set("niceToHaveSkills", [...jd.niceToHaveSkills, v]);
  const removeNice = (v: string) => set("niceToHaveSkills", jd.niceToHaveSkills.filter((s) => s !== v));

  const handlePublish = () => {
    saveToSupabase('PUBLISHED');
  };

  const publishBlocked = panelCount === 0;

  const inputCls = "h-10 text-sm border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.25)] focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none rounded-md px-3";
  const selectCls = "h-10 text-sm border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.25)] focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none rounded-md px-3 w-full appearance-none cursor-pointer bg-white";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <LeftSidebar />

        <div style={{ flex: 1, overflow: "hidden", background: D.bg }}>
          <div style={{ padding: "32px 40px", height: "100%", overflowY: "auto" }}>

            {/* Step indicator */}
            <div className="mb-6">
              <StepIndicator currentStep={currentStep} onSelectStep={setCurrentStep} />
            </div>

            {/* Page Title Bar */}
            <div className="flex items-center gap-3 mb-7">
              <div 
                onClick={() => {
                  setIsEditingHeaderTitle(true);
                  setTimeout(() => headerTitleInputRef.current?.focus(), 50);
                }}
                className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center cursor-pointer transition-colors"
                title={t("jobs.wizard.header.editHint")}
              >
                <Pencil className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1">
                {isEditingHeaderTitle ? (
                  <input
                    ref={headerTitleInputRef}
                    value={jd.title}
                    onChange={(e) => set("title", e.target.value)}
                    onBlur={() => setIsEditingHeaderTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setIsEditingHeaderTitle(false);
                    }}
                    placeholder={t("jobs.wizard.header.placeholder")}
                    className="text-lg font-semibold text-foreground tracking-tight border-b-2 border-primary outline-none bg-transparent w-full"
                  />
                ) : (
                  <div 
                    onClick={() => {
                      setIsEditingHeaderTitle(true);
                      setTimeout(() => headerTitleInputRef.current?.focus(), 50);
                    }}
                    className="group flex items-center gap-2 cursor-pointer"
                  >
                    <h1 className={cn("text-lg font-semibold tracking-tight transition-colors group-hover:text-primary", jd.title.trim() ? "text-foreground" : "text-amber-600 italic")}>
                      {jd.title.trim() || t("jobs.wizard.header.empty")}
                    </h1>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("jobs.wizard.header.help")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {t("status.DRAFT")}
              </div>
              {/* Auto-save status */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[90px]">
                {savingError && (
                  <span className="text-destructive text-[10px] max-w-[200px] truncate" title={savingError}>
                    {savingError}
                  </span>
                )}
                {saveStatus === "saving" && (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                    <span className="text-amber-600">{t("common.saving")}</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600">{t("jobs.wizard.save.saved")}</span>
                  </>
                )}
                {saveStatus === "idle" && !savingError && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    <span>{t("jobs.wizard.save.unsaved")}</span>
                  </>
                )}
              </div>
            </div>

            {isLoadingJob ? (
              <div className="flex flex-col items-center justify-center py-28 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">{t("jobs.wizard.loading")}</p>
              </div>
            ) : (
              <>
            {/* STEP 1: Main Content (Form + Preview Sidebar) */}
            {currentStep === 1 && (
              <div className="flex gap-7 items-stretch">

                {/* Form column */}
                <div className="flex-1 min-w-0 flex flex-col gap-7 max-w-[760px]">

                  {/* CARD: Position Details */}
                  <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-primary" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">{t("jobs.wizard.card.details")}</h2>
                    </div>

                    <div className="mb-5">
                      <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1">
                        {t("jobs.wizard.field.title")} <span className="text-destructive text-xs">{t("jobs.wizard.field.requiredMark")}</span>
                      </label>
                      <input
                        value={jd.title}
                        onChange={(e) => set("title", e.target.value)}
                        placeholder={t("jobs.wizard.field.titlePlaceholder")}
                        className={cn(inputCls, "h-12 text-base font-medium placeholder:font-normal placeholder:text-sm", !jd.title.trim() && "border-amber-400 focus:border-amber-500")}
                      />
                      {!jd.title.trim() && (
                        <p className="text-xs text-amber-600 mt-1">{t("jobs.wizard.field.titleEmpty")}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> {t("jobs.wizard.field.department")}
                        </label>
                        <div className="relative">
                          <select
                            value={jd.department}
                            onChange={(e) => set("department", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">{t("jobs.wizard.field.selectDepartment")}</option>
                            <option value="engineering">{t("jobs.wizard.dept.engineering")}</option>
                            <option value="search">{t("jobs.wizard.dept.search")}</option>
                            <option value="security">{t("jobs.wizard.dept.security")}</option>
                            <option value="data">{t("jobs.wizard.dept.data")}</option>
                            <option value="product">{t("jobs.wizard.dept.product")}</option>
                            <option value="design">{t("jobs.wizard.dept.design")}</option>
                            <option value="operations">{t("jobs.wizard.dept.operations")}</option>
                            <option value="finance">{t("jobs.wizard.dept.finance")}</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {t("jobs.wizard.field.location")}
                        </label>
                        <div className="relative">
                          <select
                            value={jd.location}
                            onChange={(e) => set("location", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">{t("jobs.wizard.field.selectLocation")}</option>
                            <option value="hcmc-onsite">{t("jobs.wizard.loc.hcmcOnsite")}</option>
                            <option value="hanoi-onsite">{t("jobs.wizard.loc.hanoiOnsite")}</option>
                            <option value="eu-remote">{t("jobs.wizard.loc.euRemote")}</option>
                            <option value="us-remote">{t("jobs.wizard.loc.usRemote")}</option>
                            <option value="apac-remote">{t("jobs.wizard.loc.apacRemote")}</option>
                            <option value="global-remote">{t("jobs.wizard.loc.globalRemote")}</option>
                            <option value="vancouver-hybrid">{t("jobs.wizard.loc.vancouverHybrid")}</option>
                            <option value="london-hybrid">{t("jobs.wizard.loc.londonHybrid")}</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-muted-foreground" /> {t("jobs.wizard.field.seniority")}
                        </label>
                        <div className="relative">
                          <select
                            value={jd.seniority}
                            onChange={(e) => set("seniority", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">{t("jobs.wizard.field.selectLevel")}</option>
                            <option value="intern">{t("jobs.wizard.level.intern")}</option>
                            <option value="junior">{t("jobs.wizard.level.junior")}</option>
                            <option value="mid">{t("jobs.wizard.level.mid")}</option>
                            <option value="senior">{t("jobs.wizard.level.senior")}</option>
                            <option value="staff">{t("jobs.wizard.level.staff")}</option>
                            <option value="lead">{t("jobs.wizard.level.lead")}</option>
                            <option value="manager">{t("jobs.wizard.level.manager")}</option>
                            <option value="director">{t("jobs.wizard.level.director")}</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Target className="w-3.5 h-3.5 text-muted-foreground" /> {t("jobs.wizard.field.targetOpenings")}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={jd.targetApplicants}
                          onChange={(e) => set("targetApplicants", e.target.value)}
                          placeholder={t("jobs.wizard.field.targetPlaceholder")}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> {t("jobs.wizard.field.employmentType")}
                        </label>
                        <div className="relative">
                          <select
                            value={jd.employmentType}
                            onChange={(e) => set("employmentType", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">{t("jobs.wizard.field.selectType")}</option>
                            <option value="fulltime">{t("jobs.wizard.type.fulltime")}</option>
                            <option value="parttime">{t("jobs.wizard.type.parttime")}</option>
                            <option value="intern">{t("jobs.wizard.type.intern")}</option>
                            <option value="contract">{t("jobs.wizard.type.contract")}</option>
                            <option value="freelance">{t("jobs.wizard.type.freelance")}</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" /> {t("jobs.wizard.field.workMode")}
                        </label>
                        <div className="relative">
                          <select
                            value={jd.workMode}
                            onChange={(e) => set("workMode", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">{t("jobs.wizard.field.selectMode")}</option>
                            <option value="On-site">{t("jobs.wizard.mode.onsite")}</option>
                            <option value="Hybrid">{t("jobs.wizard.mode.hybrid")}</option>
                            <option value="Remote">{t("jobs.wizard.mode.remote")}</option>
                            <option value="Flexible">{t("jobs.wizard.mode.flexible")}</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD: Skills */}
                  <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-primary" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">{t("jobs.wizard.card.skills")}</h2>
                    </div>

                    <div className="flex flex-col gap-7">
                      <div className="rounded-lg border border-primary/15 bg-[#faf9ff] p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-4 h-4 rounded bg-primary flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-primary uppercase tracking-[0.08em]">{t("jobs.wizard.skills.must")}</span>
                          <span className="ml-1.5 text-[10px] text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">{t("jobs.wizard.skills.required")}</span>
                        </div>
                        <TagInput
                          label=""
                          tags={jd.mustHaveSkills}
                          onAdd={addMust}
                          onRemove={removeMust}
                          variant="primary"
                          placeholder={t("jobs.wizard.skills.mustPlaceholder")}
                        />
                      </div>

                      <div className="rounded-lg border border-border bg-[#fafafa] p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-4 h-4 rounded border border-border bg-white flex items-center justify-center shrink-0">
                            <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          <span className="text-xs font-semibold text-foreground uppercase tracking-[0.08em]">{t("jobs.wizard.skills.nice")}</span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground bg-[rgba(15,17,23,0.06)] px-1.5 py-0.5 rounded border border-border">{t("jobs.wizard.skills.optional")}</span>
                        </div>
                        <TagInput
                          label=""
                          tags={jd.niceToHaveSkills}
                          onAdd={addNice}
                          onRemove={removeNice}
                          variant="outline"
                          placeholder={t("jobs.wizard.skills.nicePlaceholder")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD: Job Content */}
                  <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-primary" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">{t("jobs.wizard.card.content")}</h2>
                    </div>

                    <div className="flex flex-col gap-6">
                      <RichTextarea
                        id="overview"
                        label={t("jobs.wizard.content.overview")}
                        value={jd.overview}
                        onChange={(v) => set("overview", v)}
                        placeholder={t("jobs.wizard.content.overviewPlaceholder")}
                        rows={4}
                        required
                      />
                      <RichTextarea
                        id="responsibilities"
                        label={t("jobs.wizard.content.responsibilities")}
                        value={jd.responsibilities}
                        onChange={(v) => set("responsibilities", v)}
                        placeholder={t("jobs.wizard.content.responsibilitiesPlaceholder")}
                        rows={6}
                        required
                      />
                      <RichTextarea
                        id="requirements"
                        label={t("jobs.wizard.content.requirements")}
                        value={jd.requirements}
                        onChange={(v) => set("requirements", v)}
                        placeholder={t("jobs.wizard.content.requirementsPlaceholder")}
                        rows={6}
                        required
                      />
                      <RichTextarea
                        id="niceToHaveQuals"
                        label={t("jobs.wizard.content.niceToHave")}
                        value={jd.niceToHaveQuals}
                        onChange={(v) => set("niceToHaveQuals", v)}
                        placeholder={t("jobs.wizard.content.niceToHavePlaceholder")}
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* CARD: Compensation */}
                  <div className="bg-[#ffffff] rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-primary" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">
                        {t("jobs.wizard.card.compensation")} <span className="font-normal text-muted-foreground normal-case tracking-normal">{t("jobs.wizard.comp.optional")}</span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">{t("jobs.wizard.comp.min")}</label>
                        <input
                          type="number"
                          value={jd.salaryMin}
                          onChange={(e) => set("salaryMin", e.target.value)}
                          placeholder={t("jobs.wizard.comp.minPlaceholder")}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">{t("jobs.wizard.comp.max")}</label>
                        <input
                          type="number"
                          value={jd.salaryMax}
                          onChange={(e) => set("salaryMax", e.target.value)}
                          placeholder={t("jobs.wizard.comp.maxPlaceholder")}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">{t("jobs.wizard.comp.hint")}</p>
                  </div>

                  {/* Bottom actions */}
                  <div className="flex items-center justify-between py-2 pb-8">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setSaveStatus("saving"); setTimeout(() => setSaveStatus("saved"), 900); }}
                    >
                      {t("jobs.wizard.discard")}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveToSupabase('DRAFT')}
                        className="gap-1.5 border-[rgba(15,17,23,0.15)] h-9 px-4 rounded-md text-sm transition-all flex items-center"
                      >
                        <Save className="w-4 h-4" />
                        {t("jobs.wizard.saveDraft")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="gap-2 bg-primary hover:bg-primary-hover text-white shadow-sm shadow-primary/20 h-9 px-5 rounded-md text-sm transition-all flex items-center"
                      >
                        <span>{t("jobs.wizard.toStep2")}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Panel Sidebar */}
                <div className="w-[300px] shrink-0 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-[0.08em]">{t("jobs.wizard.livePreview")}</span>
                    <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t("jobs.wizard.updating")}
                    </div>
                  </div>

                  <PreviewCard jd={jd} />

                  <div className="rounded-lg border border-border bg-white p-3.5 flex flex-col gap-2">
                    <p className="text-xs font-medium text-foreground">{t("jobs.wizard.whatCandidatesSee")}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t("jobs.wizard.whatCandidatesSeeBody")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Full Preview Card View */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-6 max-w-[800px] mx-auto py-4">
                <div className="bg-white rounded-xl border border-border shadow-sm p-6 flex flex-col gap-6">
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{jd.title || t("jobs.wizard.step2.noTitle")}</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {jd.department || t("jobs.wizard.preview.deptPlaceholder")} · {jd.location || t("jobs.wizard.preview.locPlaceholder")} · {jd.workMode || t("jobs.wizard.preview.workModePlaceholder")}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {t("jobs.wizard.step2.badge")}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{t("jobs.wizard.content.overview")}</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {jd.overview || t("jobs.wizard.step2.noOverview")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{t("jobs.wizard.content.responsibilities")}</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {jd.responsibilities || t("jobs.wizard.step2.noResponsibilities")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{t("jobs.wizard.content.requirements")}</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {jd.requirements || t("jobs.wizard.step2.noRequirements")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{t("jobs.wizard.skills.must")}</h3>
                    <div className="flex flex-wrap gap-2">
                      {jd.mustHaveSkills.length > 0 ? (
                        jd.mustHaveSkills.map(s => (
                          <span key={s} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{t("jobs.wizard.step2.noSkills")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-[#f4f5f7] transition-colors"
                    >
                      {t("jobs.wizard.step2.back")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2"
                    >
                      <span>{t("jobs.wizard.step2.next")}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Candidate View Portal */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-6 max-w-[800px] mx-auto py-4">
                <div className="bg-white rounded-xl border border-border shadow-sm p-6 flex flex-col gap-6">
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{t("jobs.wizard.step3.title")}</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("jobs.wizard.step3.subtitle")}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>{t("jobs.wizard.step3.portalMode")}</span>
                    </span>
                  </div>

                  {postingId ? (
                    <ShareLinkBox url={buildJobUrl(postingId, jd.title || "Job")} />
                  ) : (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      {t("jobs.wizard.step3.hint.click")} <strong>&quot;{t("jobs.wizard.saveDraft")}&quot;</strong> {t("jobs.wizard.step3.hint.or")} <strong>&quot;{t("jobs.wizard.step3.hint.publish")}&quot;</strong> {t("jobs.wizard.step3.hint.tail")}
                    </div>
                  )}

                  <ReviewPanelPicker jobPostingId={postingId} onCountChange={setPanelCount} />

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-[#f4f5f7] transition-colors"
                    >
                      {t("jobs.wizard.step3.back")}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveToSupabase('DRAFT')}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-[#f4f5f7] transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {t("jobs.wizard.saveDraft")}
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={publishBlocked}
                        title={
                          publishBlocked
                            ? t("jobs.wizard.step3.publishBlocked")
                            : undefined
                        }
                        className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Globe className="w-4 h-4" />
                        {t("jobs.wizard.step3.publish")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
              </>
            )}

          </div>
        </div>
      </div>

      <PublishModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        jobTitle={jd.title}
        shareUrl={postingId ? buildJobUrl(postingId, jd.title) : null}
      />
    </div>
  );
}

export default function CreateJobPostingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f8f9fb]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CreateJobPostingForm />
    </Suspense>
  );
}
