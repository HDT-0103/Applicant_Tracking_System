"use client";

import React, { useState, useEffect, useRef, Suspense, KeyboardEvent } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from "../../../components/AppHeader";
import { LeftSidebar } from "../../../components/LeftSidebar";
import { D } from "../../../lib/shared";
import { supabase } from "../../../lib/supabase";
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
  Copy,
  Loader2,
} from "lucide-react";
import { buildJobUrl } from "../../../lib/jobUrl";

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
  const steps = [
    { n: 1, label: "1. Job Details" },
    { n: 2, label: "2. Preview Card" },
    { n: 3, label: "3. Candidate View Portal" },
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
                    ? "bg-[#4f46e5] text-white shadow-sm shadow-[#4f46e5]/30"
                    : isDone
                    ? "bg-[#4f46e5] text-white"
                    : "bg-[rgba(15,17,23,0.08)] text-muted-foreground",
                )}
              >
                {isDone ? <Check className="w-3 h-3" /> : step.n}
              </div>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isActive ? "text-[#4f46e5] font-semibold" : isDone ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex items-center mx-3">
                <div className={cn("h-px w-8", isDone ? "bg-[#4f46e5]/40" : "bg-border")} />
                <ChevronRight className={cn("w-3.5 h-3.5 -ml-1", isDone ? "text-[#4f46e5]/40" : "text-border")} />
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
        <span className="ml-auto text-[11px] text-muted-foreground">{tags.length} added</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="h-9 text-sm border-[rgba(15,17,23,0.15)] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 rounded-md px-3 flex-1 outline-none transition-all"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!input.trim()}
          className={cn(
            "h-9 w-9 rounded-md flex items-center justify-center shrink-0 transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            variant === "primary"
              ? "bg-[#4f46e5] text-white hover:bg-[#4338ca]"
              : "border border-[rgba(15,17,23,0.15)] bg-white text-foreground hover:bg-[#f4f5f7] hover:border-[rgba(15,17,23,0.3)]",
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No skills added yet — type above and press Enter</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              variant === "primary"
                ? "bg-[#4f46e5]/10 text-[#4f46e5] border border-[#4f46e5]/20 hover:bg-[#4f46e5]/15"
                : "bg-white text-foreground border border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]",
            )}
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className={cn(
                "rounded-sm p-0.5 hover:bg-black/10 transition-colors",
                variant === "primary" ? "text-[#4f46e5]" : "text-muted-foreground",
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
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {required && <span className="text-destructive text-xs">*</span>}
        <span className="ml-auto text-[11px] text-muted-foreground">{value.length} chars</span>
      </div>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border border-b-0 border-[rgba(15,17,23,0.15)] rounded-t-md bg-[#f8f9fb]">
        {[
          { icon: Bold, tip: "Bold" },
          { icon: Italic, tip: "Italic" },
          { icon: Code2, tip: "Code" },
          { icon: List, tip: "List" },
          { icon: AlignLeft, tip: "Paragraph" },
        ].map(({ icon: Icon, tip }) => (
          <button
            key={tip}
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
        className="rounded-t-none border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.25)] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 text-sm resize-none transition-all outline-none font-mono text-[13px] leading-relaxed w-full px-3 py-2 bg-white"
      />
    </div>
  );
}

function PreviewCard({ jd }: { jd: JDState }) {
  const title = jd.title || "Job Title";
  const dept = jd.department || "Department";
  const loc = jd.location || "Location";
  const mode = jd.workMode || "On-site";
  const seniority = jd.seniority || "Mid";
  const allMustHave = jd.mustHaveSkills.length > 0 ? jd.mustHaveSkills : [];
  const allNiceToHave = jd.niceToHaveSkills.length > 0 ? jd.niceToHaveSkills : [];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-[#4f46e5] to-[#6d28d9] px-5 py-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">GC</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open
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
            <Icon className="w-3.5 h-3.5 text-[#4f46e5]/60" />
            {text}
          </div>
        ))}
      </div>

      <div className="px-5 py-4 flex flex-col gap-3.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Must-Have Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMustHave.slice(0, 6).map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-[#4f46e5]/10 text-[#4f46e5] border border-[#4f46e5]/20 font-medium">
                {s}
              </span>
            ))}
            {allMustHave.length > 6 && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#f4f5f7] text-muted-foreground border border-border font-medium">
                +{allMustHave.length - 6} more
              </span>
            )}
          </div>
        </div>
        {allNiceToHave.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Nice-to-Have
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
          className="w-full h-9 rounded-lg bg-[#4f46e5] text-white text-sm font-semibold hover:bg-[#4338ca] transition-colors"
        >
          Apply Now
        </button>
      </div>
    </div>
  );
}

function ShareLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Public application link
      </span>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 flex-1 min-w-0 rounded-lg border border-border bg-[#f8f9fb] px-3
            text-xs font-mono text-foreground outline-none focus:border-[#4f46e5]"
        />
        <button
          type="button"
          onClick={copy}
          className="h-9 shrink-0 rounded-lg bg-[#4f46e5] px-3 text-xs font-medium text-white
            transition-colors hover:bg-[#4338ca] flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Share this link anywhere. Every CV submitted through it is attached to this job only.
      </p>
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-w-[480px] w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-br from-[#4f46e5] to-[#6d28d9] px-8 py-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">Job Description Published!</h2>
            <p className="text-sm text-white/70 mt-1.5">
              <span className="font-medium text-white/90">{jobTitle || "Your position"}</span> is now live and accepting applications.
            </p>
          </div>
        </div>

        <div className="px-8 py-6 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Globe, label: "Live on Portal", color: "emerald" },
              { icon: Users, label: "Accepting Apps", color: "blue" },
              { icon: Sparkles, label: "AI Enrichment On", color: "violet" },
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
            Candidates can now discover and apply for this position. Profile enrichment via GitHub and LinkedIn is active for all submissions.
          </p>

          {shareUrl && <ShareLinkBox url={shareUrl} />}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 rounded-lg border border-border bg-white text-sm font-medium
                text-foreground hover:bg-[#f4f5f7] transition-colors"
            >
              Continue Editing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateJobPostingForm() {
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
        const { data: job, error } = await supabase
          .from('jobs_posting')
          .select('*')
          .eq('id', editJobId)
          .single();

        if (error) throw error;

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
    const data = jdRef.current;
    if (!data.title || !data.title.trim()) {
      setSavingError("Job title is required!");
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    setSavingError(null);

    const payload = {
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
      status,
      ...(status === 'PUBLISHED' ? { posted_at: new Date().toISOString() } : {}),
      ...(postingId ? {} : { last_saved_at: new Date().toISOString() }),
    };

    try {
      if (postingId) {
        const { error } = await supabase
          .from('jobs_posting')
          .update({ ...payload, last_saved_at: new Date().toISOString() })
          .eq('id', postingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('jobs_posting')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setPostingId(inserted.id);
      }
      setSaveStatus("saved");
      if (status === 'PUBLISHED') {
        setShowPublishModal(true);
      }
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
      setSavingError(err instanceof Error ? err.message : 'Save failed');
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

  const inputCls = "h-10 text-sm border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.25)] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 transition-all outline-none rounded-md px-3";
  const selectCls = "h-10 text-sm border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.25)] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 transition-all outline-none rounded-md px-3 w-full appearance-none cursor-pointer bg-white";

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
                className="w-9 h-9 rounded-xl bg-[#4f46e5]/10 hover:bg-[#4f46e5]/20 flex items-center justify-center cursor-pointer transition-colors"
                title="Click to edit position title"
              >
                <Pencil className="w-4.5 h-4.5 text-[#4f46e5]" />
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
                    placeholder="Enter position title (Required)..."
                    className="text-lg font-semibold text-foreground tracking-tight border-b-2 border-[#4f46e5] outline-none bg-transparent w-full"
                  />
                ) : (
                  <div 
                    onClick={() => {
                      setIsEditingHeaderTitle(true);
                      setTimeout(() => headerTitleInputRef.current?.focus(), 50);
                    }}
                    className="group flex items-center gap-2 cursor-pointer"
                  >
                    <h1 className={cn("text-lg font-semibold tracking-tight transition-colors group-hover:text-[#4f46e5]", jd.title.trim() ? "text-foreground" : "text-amber-600 italic")}>
                      {jd.title.trim() || "Position Title (Required) *"}
                    </h1>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Position title is required. Click the title or pencil icon to edit directly.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Draft
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
                    <span className="text-amber-600">Saving…</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600">Draft saved</span>
                  </>
                )}
                {saveStatus === "idle" && !savingError && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    <span>Unsaved</span>
                  </>
                )}
              </div>
            </div>

            {isLoadingJob ? (
              <div className="flex flex-col items-center justify-center py-28 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5]" />
                <p className="text-sm font-medium text-muted-foreground">Loading position details...</p>
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
                      <div className="w-1 h-5 rounded-full bg-[#4f46e5]" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">Position Details</h2>
                    </div>

                    <div className="mb-5">
                      <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1">
                        Job Title <span className="text-destructive text-xs">* (Required)</span>
                      </label>
                      <input
                        value={jd.title}
                        onChange={(e) => set("title", e.target.value)}
                        placeholder='e.g. "Senior ML Engineer" or "Mobile Security Engineer Intern"'
                        className={cn(inputCls, "h-12 text-base font-medium placeholder:font-normal placeholder:text-sm", !jd.title.trim() && "border-amber-400 focus:border-amber-500")}
                      />
                      {!jd.title.trim() && (
                        <p className="text-xs text-amber-600 mt-1">Position title is required and cannot be empty.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Department
                        </label>
                        <div className="relative">
                          <select
                            value={jd.department}
                            onChange={(e) => set("department", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">Select department…</option>
                            <option value="engineering">Technology – Engineering</option>
                            <option value="search">Search & Ranking</option>
                            <option value="security">Security & Trust</option>
                            <option value="data">Data Science & ML</option>
                            <option value="product">Product Management</option>
                            <option value="design">Design & UX</option>
                            <option value="operations">Operations</option>
                            <option value="finance">Finance & Legal</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Location
                        </label>
                        <div className="relative">
                          <select
                            value={jd.location}
                            onChange={(e) => set("location", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">Select location…</option>
                            <option value="hcmc-onsite">Ho Chi Minh / On-site</option>
                            <option value="hanoi-onsite">Hanoi / On-site</option>
                            <option value="eu-remote">EU / Remote</option>
                            <option value="us-remote">US / Remote</option>
                            <option value="apac-remote">APAC / Remote</option>
                            <option value="global-remote">Global / Fully Remote</option>
                            <option value="vancouver-hybrid">Vancouver / Hybrid</option>
                            <option value="london-hybrid">London / Hybrid</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-muted-foreground" /> Seniority Level
                        </label>
                        <div className="relative">
                          <select
                            value={jd.seniority}
                            onChange={(e) => set("seniority", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">Select level…</option>
                            <option value="intern">Intern</option>
                            <option value="junior">Junior (0–2 yrs)</option>
                            <option value="mid">Mid-level (2–5 yrs)</option>
                            <option value="senior">Senior (5–8 yrs)</option>
                            <option value="staff">Staff / Principal</option>
                            <option value="lead">Tech Lead</option>
                            <option value="manager">Engineering Manager</option>
                            <option value="director">Director+</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Target className="w-3.5 h-3.5 text-muted-foreground" /> Target Applicants / Openings
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={jd.targetApplicants}
                          onChange={(e) => set("targetApplicants", e.target.value)}
                          placeholder="e.g. 200"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Employment Type
                        </label>
                        <div className="relative">
                          <select
                            value={jd.employmentType}
                            onChange={(e) => set("employmentType", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">Select type…</option>
                            <option value="fulltime">Full-time</option>
                            <option value="parttime">Part-time</option>
                            <option value="intern">Internship</option>
                            <option value="contract">Contract</option>
                            <option value="freelance">Freelance</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Work Mode
                        </label>
                        <div className="relative">
                          <select
                            value={jd.workMode}
                            onChange={(e) => set("workMode", e.target.value)}
                            className={selectCls}
                          >
                            <option value="">Select mode…</option>
                            <option value="On-site">On-site</option>
                            <option value="Hybrid">Hybrid</option>
                            <option value="Remote">Remote</option>
                            <option value="Flexible">Flexible</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD: Skills */}
                  <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-[#4f46e5]" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">Skills & Expertise</h2>
                    </div>

                    <div className="flex flex-col gap-7">
                      <div className="rounded-lg border border-[#4f46e5]/15 bg-[#faf9ff] p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-4 h-4 rounded bg-[#4f46e5] flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-[#4f46e5] uppercase tracking-[0.08em]">Must-Have Skills</span>
                          <span className="ml-1.5 text-[10px] text-[#4f46e5]/60 bg-[#4f46e5]/10 px-1.5 py-0.5 rounded">Required</span>
                        </div>
                        <TagInput
                          label=""
                          tags={jd.mustHaveSkills}
                          onAdd={addMust}
                          onRemove={removeMust}
                          variant="primary"
                          placeholder="Add a required skill (e.g. Python, Docker…)"
                        />
                      </div>

                      <div className="rounded-lg border border-border bg-[#fafafa] p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-4 h-4 rounded border border-border bg-white flex items-center justify-center shrink-0">
                            <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          <span className="text-xs font-semibold text-foreground uppercase tracking-[0.08em]">Nice-to-Have Skills</span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground bg-[rgba(15,17,23,0.06)] px-1.5 py-0.5 rounded border border-border">Optional</span>
                        </div>
                        <TagInput
                          label=""
                          tags={jd.niceToHaveSkills}
                          onAdd={addNice}
                          onRemove={removeNice}
                          variant="outline"
                          placeholder="Add a preferred skill (e.g. LLM evaluation, Ray…)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD: Job Content */}
                  <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-[#4f46e5]" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">Job Content</h2>
                    </div>

                    <div className="flex flex-col gap-6">
                      <RichTextarea
                        id="overview"
                        label="Role Overview"
                        value={jd.overview}
                        onChange={(v) => set("overview", v)}
                        placeholder="Brief summary of the role, the team, and what the candidate will accomplish…"
                        rows={4}
                        required
                      />
                      <RichTextarea
                        id="responsibilities"
                        label="Key Responsibilities"
                        value={jd.responsibilities}
                        onChange={(v) => set("responsibilities", v)}
                        placeholder="- Own the design and implementation of…&#10;- Collaborate with cross-functional teams to…&#10;- Drive technical decisions across…"
                        rows={6}
                        required
                      />
                      <RichTextarea
                        id="requirements"
                        label="Requirements"
                        value={jd.requirements}
                        onChange={(v) => set("requirements", v)}
                        placeholder="- 3+ years of experience with…&#10;- Strong proficiency in Python and…&#10;- Experience building production ML systems…"
                        rows={6}
                        required
                      />
                      <RichTextarea
                        id="niceToHaveQuals"
                        label="Nice-to-Have Qualifications"
                        value={jd.niceToHaveQuals}
                        onChange={(v) => set("niceToHaveQuals", v)}
                        placeholder="- Familiarity with LLM evaluation frameworks…&#10;- Prior internship at a tech company…"
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* CARD: Compensation */}
                  <div className="bg-[#ffffff] rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1 h-5 rounded-full bg-[#4f46e5]" />
                      <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.06em]">
                        Compensation <span className="font-normal text-muted-foreground normal-case tracking-normal">(Optional)</span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Salary Min (USD/yr)</label>
                        <input
                          type="number"
                          value={jd.salaryMin}
                          onChange={(e) => set("salaryMin", e.target.value)}
                          placeholder="e.g. 80000"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Salary Max (USD/yr)</label>
                        <input
                          type="number"
                          value={jd.salaryMax}
                          onChange={(e) => set("salaryMax", e.target.value)}
                          placeholder="e.g. 120000"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Leave blank to hide compensation from the candidate-facing portal.</p>
                  </div>

                  {/* Bottom actions */}
                  <div className="flex items-center justify-between py-2 pb-8">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setSaveStatus("saving"); setTimeout(() => setSaveStatus("saved"), 900); }}
                    >
                      Discard changes
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveToSupabase('DRAFT')}
                        className="gap-1.5 border-[rgba(15,17,23,0.15)] h-9 px-4 rounded-md text-sm transition-all flex items-center"
                      >
                        <Save className="w-4 h-4" />
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-sm shadow-[#4f46e5]/20 h-9 px-5 rounded-md text-sm transition-all flex items-center"
                      >
                        <span>Preview Card (Step 2)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Panel Sidebar */}
                <div className="w-[300px] shrink-0 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-[0.08em]">Live Preview</span>
                    <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Updating
                    </div>
                  </div>

                  <PreviewCard jd={jd} />

                  <div className="rounded-lg border border-border bg-white p-3.5 flex flex-col gap-2">
                    <p className="text-xs font-medium text-foreground">What candidates see</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      This card appears on the candidate portal. Clicking &quot;Apply Now&quot; opens the full application form with GitHub and LinkedIn enrichment.
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
                      <h2 className="text-xl font-bold text-foreground">{jd.title || "No position title entered"}</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {jd.department || "Department"} · {jd.location || "Location"} · {jd.workMode || "Work Mode"}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Step 2: Preview Card
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-[#4f46e5] uppercase tracking-wide mb-2">Role Overview</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {jd.overview || "No role overview provided yet..."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-[#4f46e5] uppercase tracking-wide mb-2">Key Responsibilities</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {jd.responsibilities || "No responsibilities provided yet..."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-[#4f46e5] uppercase tracking-wide mb-2">Requirements</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {jd.requirements || "No requirements provided yet..."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-[#4f46e5] uppercase tracking-wide mb-2">Must-Have Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {jd.mustHaveSkills.length > 0 ? (
                        jd.mustHaveSkills.map(s => (
                          <span key={s} className="px-2.5 py-1 rounded-md bg-[#4f46e5]/10 text-[#4f46e5] text-xs font-medium border border-[#4f46e5]/20">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No required skills added</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-[#f4f5f7] transition-colors"
                    >
                      ← Back to Edit (Step 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="px-5 py-2 rounded-lg bg-[#4f46e5] text-white text-sm font-semibold hover:bg-[#4338ca] transition-colors flex items-center gap-2"
                    >
                      <span>Proceed to Candidate View Portal (Step 3)</span>
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
                      <h2 className="text-xl font-bold text-foreground">Step 3: Candidate View Portal</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        Public candidate application portal for job position
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Portal Mode</span>
                    </span>
                  </div>

                  {postingId ? (
                    <ShareLinkBox url={buildJobUrl(postingId, jd.title || "Job")} />
                  ) : (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Click <strong>&quot;Save Draft&quot;</strong> or <strong>&quot;Publish&quot;</strong> to generate a public application link for candidates.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-[#f4f5f7] transition-colors"
                    >
                      ← Back to Preview Card (Step 2)
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveToSupabase('DRAFT')}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-[#f4f5f7] transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        className="px-5 py-2 rounded-lg bg-[#4f46e5] text-white text-sm font-semibold hover:bg-[#4338ca] transition-colors flex items-center gap-2"
                      >
                        <Globe className="w-4 h-4" />
                        Publish & Open Applications
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
          <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5]" />
        </div>
      }
    >
      <CreateJobPostingForm />
    </Suspense>
  );
}
