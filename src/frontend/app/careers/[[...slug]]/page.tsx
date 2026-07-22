"use client";

import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter, useParams } from 'next/navigation';
import { D } from "../../../lib/shared";
import { supabase } from "../../../lib/supabase";
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
} from "lucide-react";

type Phase = "form" | "loading" | "results";

interface FormData {
  resume: File | null;
  fullName: string;
  pronouns: string;
  customPronoun: string;
  email: string;
  phone: string;
  location: string;
  company: string;
  linkedin: string;
  github: string;
  portfolio: string;
  website: string;
  workEligibility: string;
  officeAttendance: string;
  university: string;
  fieldOfStudy: string;
  educationLevel: string;
  availability: string;
  hearAbout: string;
  talentNetwork: string;
  anythingElse: string;
  ageGroup: string;
  genderIdentity: string;
  race: string[];
  military: string;
  disability: string;
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

const PRONOUNS_GRID = [
  { value: "he/him", label: "He/him" },
  { value: "she/her", label: "She/her" },
  { value: "they/them", label: "They/them" },
  { value: "xe/xem", label: "Xe/xem" },
  { value: "ze/hir", label: "Ze/hir" },
  { value: "ey/em", label: "Ey/em" },
  { value: "hir/hir", label: "Hir/hir" },
  { value: "fae/faer", label: "Fae/faer" },
  { value: "hu/hu", label: "Hu/hu" },
];



const RACE_OPTIONS = [
  { value: "american-indian", label: "American Indian or Alaska Native" },
  { value: "asian", label: "Asian" },
  { value: "black", label: "Black or African American" },
  { value: "indigenous", label: "Indigenous or Native" },
  { value: "latinx", label: "Latino/Hispanic" },
  { value: "pacific-islander", label: "Native Hawaiian or Other Pacific Islander" },
  { value: "white", label: "White" },
  { value: "other-race", label: "Other" },
];

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

function UniversitySelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; country: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = search.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("universities")
        .select("id, name, country")
        .ilike("name", `%${q}%`)
        .limit(10);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border bg-white px-3 h-10 text-left text-sm transition-all outline-none",
          open ? "ring-2 ring-[#4f46e5]/25 border-[#4f46e5]" : error ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]",
        )}>
        <GraduationCap className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className={cn("flex-1 truncate text-sm", !value && "text-muted-foreground")}>
          {value || "Select a university or college"}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-white shadow-lg">
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search institutions…" className="h-10 text-sm border-0 outline-none bg-transparent flex-1" />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {!search.trim() ? (
              <p className="py-6 text-sm text-center text-muted-foreground">Type to search institutions…</p>
            ) : results.length === 0 && !searching ? (
              <p className="py-4 text-sm text-center text-muted-foreground">No institution found.</p>
            ) : (
              results.map((uni) => (
                <button key={uni.id} type="button" onClick={() => { onChange(uni.name); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[#f5f3ff] transition-colors text-left">
                  <Check className={cn("w-4 h-4 text-[#4f46e5] shrink-0", value === uni.name ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{uni.name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{uni.country}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <FieldError msg={error} />
    </div>
  );
}

function LoadingScreen() {
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

function ResultsPanel({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">Thank you {name}!</p>
        <p className="text-muted-foreground mt-1">Your application has been submitted successfully. We will contact you as soon as possible.</p>
      </div>
      <button onClick={onReset} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
        Nộp đơn mới
      </button>
    </div>
  );
}

function ApplicationForm({ onSubmit }: { onSubmit: (d: FormData) => void }) {
  const [form, setForm] = useState<FormData>({
    resume: null, fullName: "", pronouns: "", customPronoun: "", email: "", phone: "",
    location: "", company: "", linkedin: "", github: "", portfolio: "", website: "",
    workEligibility: "", officeAttendance: "", university: "", fieldOfStudy: "",
    educationLevel: "", availability: "", hearAbout: "", talentNetwork: "",
    anythingElse: "", ageGroup: "", genderIdentity: "", race: [], military: "", disability: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const toggleRace = (val: string) =>
    set("race", form.race.includes(val) ? form.race.filter((r) => r !== val) : [...form.race, val]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.resume) e.resume = "Please upload your resume / CV";
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email address is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.workEligibility) e.workEligibility = "Please select your work eligibility";
    if (!form.officeAttendance) e.officeAttendance = "Please indicate office attendance availability";
    if (!form.educationLevel) e.educationLevel = "Please select your education level";
    if (!form.availability) e.availability = "Please select your availability";
    if (!form.hearAbout) e.hearAbout = "Please select how you heard about this role";
    if (!form.talentNetwork) e.talentNetwork = "Please select an option";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit(form);
  };

  const socialLinks = [
    { key: "linkedin" as const, label: "LinkedIn URL", icon: <Linkedin className="w-4 h-4 text-[#0a66c2]" />, ph: "linkedin.com/in/your-profile" },
    { key: "github" as const, label: "GitHub URL", icon: <Github className="w-4 h-4 text-[#24292e]" />, ph: "github.com/yourusername" },
    { key: "portfolio" as const, label: "Portfolio URL", icon: <Globe className="w-4 h-4 text-[#4f46e5]" />, ph: "https://yoursite.com" },
    { key: "website" as const, label: "Other website", icon: <Link2 className="w-4 h-4 text-muted-foreground" />, ph: "" },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">

      {/* SECTION 1 – CORE PROFILE */}
      <section>
        <SectionHeading label="Submit Your Application" />
        <ResumeUploader file={form.resume} onChange={(f) => set("resume", f)} error={errors.resume} />

        <div className="mb-5">
          <FieldLabel htmlFor="fullName" required>Full name</FieldLabel>
          <input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls(errors.fullName)} />
          <FieldError msg={errors.fullName} />
        </div>

        <div className="mb-5">
          <FieldLabel>Pronouns</FieldLabel>
          <div className="grid grid-cols-3 gap-x-8 gap-y-2 mb-2">
            {PRONOUNS_GRID.map((p) => (
              <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pronouns === p.value}
                  onChange={() => set("pronouns", form.pronouns === p.value ? "" : p.value)}
                  className="w-3.5 h-3.5 rounded border-border accent-[#4f46e5] cursor-pointer" />
                <span className="text-sm text-foreground">{p.label}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer mb-1.5">
            <input type="checkbox" checked={form.pronouns === "name-only"}
              onChange={() => set("pronouns", form.pronouns === "name-only" ? "" : "name-only")}
              className="w-3.5 h-3.5 rounded border-border accent-[#4f46e5]" />
            <span className="text-sm text-foreground">Use name only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={form.pronouns === "custom"}
              onChange={() => set("pronouns", form.pronouns === "custom" ? "" : "custom")}
              className="w-3.5 h-3.5 rounded border-border accent-[#4f46e5]" />
            <span className="text-sm text-foreground">Custom</span>
          </label>
          {form.pronouns === "custom" && (
            <input placeholder="Enter your preferred pronouns" value={form.customPronoun}
              onChange={(e) => set("customPronoun", e.target.value)} className={inputCls() + " mt-1"} />
          )}
          <p className="text-xs text-muted-foreground mt-2">Optional: let us know your preferred pronouns</p>
        </div>

        <div className="mb-5">
          <FieldLabel htmlFor="email" required>Email</FieldLabel>
          <input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls(errors.email)} />
          <FieldError msg={errors.email} />
        </div>

        <div className="mb-5">
          <FieldLabel htmlFor="phone" required>Phone</FieldLabel>
          <input id="phone" type="tel" placeholder="+84 (0) 90 000 0000" value={form.phone}
            onChange={(e) => set("phone", e.target.value)} className={inputCls(errors.phone)} />
          <FieldError msg={errors.phone} />
        </div>

        <div className="mb-5">
          <FieldLabel htmlFor="location">Current location</FieldLabel>
          <input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls()} />
        </div>

        <div>
          <FieldLabel htmlFor="company">Current company</FieldLabel>
          <input id="company" value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls()} />
        </div>
      </section>

      {/* SECTION 2 – SOCIAL LINKS */}
      <section>
        <SectionHeading label="Links" />
        <div className="flex flex-col gap-4">
          {socialLinks.map(({ key, label, icon, ph }) => (
            <div key={key} className="grid grid-cols-[190px_1fr] items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#4f46e5] font-medium cursor-default">
                {icon}{label}
              </label>
              <input value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={ph}
                className={cn(baseCls, "px-3 w-full border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)] bg-white")} />
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 – APPLICATION QUESTIONS */}
      <section>
        <SectionHeading label="Application Questions" />
        <div className="flex flex-col gap-6">

          <div>
            <FieldLabel required>Are you legally authorized to work in the location of this job posting?</FieldLabel>
            <div className="relative">
              <select value={form.workEligibility} onChange={(e) => set("workEligibility", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.workEligibility ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="authorized">Yes, fully authorized (Full-time / Part-time)</option>
                <option value="sponsorship">Requires visa sponsorship</option>
                <option value="pending">Pending work authorization / In process</option>
                <option value="not-authorized">Not currently authorized</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.workEligibility} />
          </div>

          <div>
            <FieldLabel required>
              We have an in-person / hybrid office attendance policy. Are you able to work at the specified office location by your start date?
            </FieldLabel>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="radio" name="officeAttendance" value="yes" checked={form.officeAttendance === "yes"}
                  onChange={(e) => set("officeAttendance", e.target.value)} className="mt-0.5 shrink-0 accent-[#4f46e5]" />
                <span className="text-sm text-foreground leading-snug">Yes, I am able to meet the in-person attendance requirements at this location</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="radio" name="officeAttendance" value="no" checked={form.officeAttendance === "no"}
                  onChange={(e) => set("officeAttendance", e.target.value)} className="mt-0.5 shrink-0 accent-[#4f46e5]" />
                <span className="text-sm text-foreground leading-snug">No, I am unable to work at this office location</span>
              </label>
            </div>
            <FieldError msg={errors.officeAttendance} />
          </div>

          <div>
            <FieldLabel>
              University / College{" "}
              <span className="text-muted-foreground font-normal text-xs">(Optional / If applicable — Select from list or type if not listed)</span>
            </FieldLabel>
            <UniversitySelect value={form.university} onChange={(v) => set("university", v)} error={errors.university} />
          </div>

          <div>
            <FieldLabel htmlFor="fieldOfStudy">
              Field of Study / Major / Degree Program{" "}
              <span className="text-muted-foreground font-normal text-xs">(If applicable)</span>
            </FieldLabel>
            <input id="fieldOfStudy" type="text" value={form.fieldOfStudy}
              onChange={(e) => set("fieldOfStudy", e.target.value)}
              placeholder='E.g. "Computer Science", "Business Administration", "Electrical Engineering"'
              className={inputCls()} />
          </div>

          <div>
            <FieldLabel required>What is your highest level of education completed or expected completion year?</FieldLabel>
            <div className="relative">
              <select value={form.educationLevel} onChange={(e) => set("educationLevel", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.educationLevel ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="high-school">High School / Secondary</option>
                <option value="bachelors-completed">Bachelor's Degree (Completed)</option>
                <option value="masters-doctorate">Master's / Doctorate Degree (Completed)</option>
                <option value="currently-enrolled">Currently Enrolled (Expected graduation: 2026 or later)</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.educationLevel} />
          </div>

          <div>
            <FieldLabel required>What is your current employment status and availability to start?</FieldLabel>
            <div className="relative">
              <select value={form.availability} onChange={(e) => set("availability", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.availability ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="immediate">Available immediately</option>
                <option value="2-4-weeks">Requires 2–4 weeks' notice period</option>
                <option value="1-2-months">Requires 1–2 months' notice period</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.availability} />
          </div>

          <div>
            <FieldLabel required>Where did you hear about this position?</FieldLabel>
            <div className="relative">
              <select value={form.hearAbout} onChange={(e) => set("hearAbout", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.hearAbout ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="linkedin">LinkedIn</option>
                <option value="company-website">Company Website / Careers Page</option>
                <option value="referral">Employee Referral</option>
                <option value="job-board">Job Board (Indeed, Glassdoor…)</option>
                <option value="university">University / Career Fair</option>
                <option value="social-media">Social Media</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.hearAbout} />
          </div>

          <div>
            <FieldLabel required>Are you part of our Preferred Talent Network?</FieldLabel>
            <div className="relative">
              <select value={form.talentNetwork} onChange={(e) => set("talentNetwork", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.talentNetwork ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not-sure">I'm not sure</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.talentNetwork} />
          </div>

          <div>
            <FieldLabel htmlFor="anythingElse">
              Anything else you would like us to know?{" "}
              <span className="font-normal text-muted-foreground">(Optional)</span>
            </FieldLabel>
            <textarea id="anythingElse" rows={4} value={form.anythingElse}
              onChange={(e) => set("anythingElse", e.target.value)} className={textareaCls} />
          </div>
        </div>
      </section>

      {/* SECTION 4 – DIVERSITY SURVEY */}
      <section>
        <SectionHeading label="Diversity Survey" />
        <div className="rounded-lg border border-[rgba(79,70,229,0.18)] bg-[#faf9ff] p-5 mb-7 text-sm text-foreground leading-relaxed">
          Diversity, equity, and inclusion are an important part of who we are. We strive to be reflective
          of our local communities and are proactive in our efforts to advance diversity, inclusion, and equity. To help
          us evaluate our DEI efforts, we invite you to complete this optional survey. Submission of the information on
          this form is strictly voluntary. If you choose to participate or not, it will not subject you to any adverse
          treatment or affect your job application. Information obtained will be anonymous and kept separate from your
          review and job application. This information will be kept secure and confidential and will be solely used for
          DEI evaluation in accordance with our Applicant Privacy Notice. Thank you.
        </div>

        <div className="flex flex-col gap-7">
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Which age group do you belong to?</p>
            <div className="flex flex-col gap-2">
              {["Under 21", "21-29", "30-39", "40-49", "50-59", "60-69", "70+"].map((age) => (
                <label key={age} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name="ageGroup" value={age} checked={form.ageGroup === age}
                    onChange={(e) => set("ageGroup", e.target.value)} className="shrink-0 accent-[#4f46e5]" />
                  <span className="text-sm text-foreground">{age}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">What gender do you identify as?</p>
            <div className="flex flex-col gap-2">
              {["Female", "Gender fluid", "Male", "Non-binary", "Two-spirit"].map((g) => (
                <label key={g} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name="genderIdentity" value={g} checked={form.genderIdentity === g}
                    onChange={(e) => set("genderIdentity", e.target.value)} className="shrink-0 accent-[#4f46e5]" />
                  <span className="text-sm text-foreground">{g}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              How would you best describe your race?{" "}
              <span className="font-normal text-muted-foreground">(Please select all that apply)</span>
            </p>
            <div className="flex flex-col gap-2 mt-3">
              {RACE_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.race.includes(value)}
                    onChange={() => toggleRace(value)}
                    className="w-4 h-4 rounded border-[rgba(15,17,23,0.25)] accent-[#4f46e5] cursor-pointer" />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Have you ever served on active duty in the military?</p>
            <div className="flex flex-col gap-2">
              {[
                "Currently on active duty",
                "Never served in the military",
                "Only on active duty for training in the Reserves or National Guard",
                "On active duty in the past, but not currently",
              ].map((m) => (
                <label key={m} className="flex items-start gap-2.5 cursor-pointer">
                  <input type="radio" name="military" value={m} checked={form.military === m}
                    onChange={(e) => set("military", e.target.value)} className="mt-0.5 shrink-0 accent-[#4f46e5]" />
                  <span className="text-sm text-foreground leading-snug">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Do you consider yourself to have a condition, impairment, or disability?</p>
            <div className="flex flex-col gap-2">
              {["No disability", "Physical disability", "Learning disability", "Mental disability", "Multiple disabilities"].map((d) => (
                <label key={d} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name="disability" value={d} checked={form.disability === d}
                    onChange={(e) => set("disability", e.target.value)} className="shrink-0 accent-[#4f46e5]" />
                  <span className="text-sm text-foreground">{d}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <div className="pt-2 pb-4">
        <div className="h-px bg-border mb-7" />
        <button type="submit"
          className="w-full h-11 rounded-md bg-[#4f46e5] text-white font-semibold text-sm
            hover:bg-[#4338ca] active:scale-[0.99] transition-all shadow-sm
            focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2">
          Submit Application
        </button>

        <div className="mt-5 rounded-md border border-border bg-[#fafafa] p-4">
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            We may use artificial intelligence (AI) tools to support parts of the hiring process, such as reviewing
            applications, analysing resumes, or scanning responses and identifying potential inconsistencies or
            verification signals in application materials based on available information. These tools assist our
            recruitment team but do not replace human judgment. Final hiring decisions are ultimately made by humans.{" "}
            <span className="text-[#4f46e5] cursor-pointer hover:underline">
              If you would like more information about how your data is processed, please contact us.
            </span>
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Jobs powered by <span className="font-semibold text-foreground tracking-tight">SmartATS</span>
        </p>
      </div>
    </form>
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

  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [submittedName, setSubmittedName] = useState("");

  useEffect(() => {
    const loadJobData = async () => {
      try {
        let query = supabase
          .from('jobs_posting')
          .select('*');

        if (slug) {
          const decoded = decodeURIComponent(slug);
          query = query.ilike('job_title', decoded);
        } else {
          query = query.eq('status', 'PUBLISHED');
        }

        const { data, error: fetchError } = await query.order('created_at', { ascending: false }).limit(1);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          setSelectedJob(data[0] as JobPosting);
        } else {
          setError('No published job found');
        }
      } catch (err) {
        console.error('Failed to load job data:', err);
        setError('Failed to load job postings');
      } finally {
        setLoading(false);
      }
    };
    loadJobData();
  }, [slug]);

  const handleSubmit = async (form: FormData) => {
    setSubmitting(true);
    setError(null);
    setSubmittedName(form.fullName);

    try {
      const formDataUpload = new FormData();
      if (form.resume) formDataUpload.append('file', form.resume);
      formDataUpload.append('full_name', form.fullName);
      formDataUpload.append('email', form.email);
      formDataUpload.append('phone', form.phone);
      formDataUpload.append('linkedin_url', form.linkedin);
      formDataUpload.append('github_url', form.github);
      formDataUpload.append('job_id', selectedJob?.id || '');
      formDataUpload.append('job_title', selectedJob?.job_title || '');

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

      // Save additional candidate fields to Supabase
      const githubUsername = form.github
        ? form.github.replace(/\/+$/, '').split('/').pop() || null
        : null;

      const { error: candidateError } = await supabase
        .from('candidates')
        .upsert({
          uuid: candidateUuid,
          full_name: form.fullName,
          email: form.email,
          phone: form.phone,
          current_location: form.location || null,
          current_company: form.company || null,
          pronouns: form.pronouns || null,
          custom_pronouns: form.customPronoun || null,
          linkedin_url: form.linkedin || null,
          github_username: githubUsername,
          portfolio_url: form.portfolio || null,
          website_url: form.website || null,
          university: form.university || null,
          faculty_program: form.fieldOfStudy || null,
          graduation_year: form.educationLevel || null,
          age_group: form.ageGroup || null,
          gender_identity: form.genderIdentity || null,
          race: form.race.length > 0 ? form.race : [],
          military_status: form.military || null,
          disability_status: form.disability || null,
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
      const { error: applicationError } = await supabase
        .from('applications')
        .insert({
          candidate_uuid: candidateUuid,
          job_posting_id: selectedJob?.id,
          resume_id: resumeData.id,
          work_authorization: form.workEligibility === 'authorized',
          office_attendance: form.officeAttendance === 'yes',
          referral_source: form.hearAbout || null,
          preferred_talent_network: form.talentNetwork === 'yes',
          additional_information: form.anythingElse || null,
        });

      if (applicationError) {
        console.error('application insert error:', applicationError);
        throw new Error(applicationError.message || 'Failed to save application');
      }

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

      {/* Candidate Portal Header Banner */}
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

      {/* Topnav */}
      <header className="h-12 bg-white border-b border-border flex items-center px-7 gap-3 shrink-0 z-20 mt-8">
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

            {phase === "form" && (
              <>
                <div className="mb-7">
                  <h2 className="text-xl font-semibold text-foreground tracking-tight">
                    {selectedJob?.job_title || "Position"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedJob?.location || "Location"} &nbsp;·&nbsp; {selectedJob?.department || "Department"} / {selectedJob?.employment_type || "Type"} / {selectedJob?.work_mode || "On-site"}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
                  <ApplicationForm onSubmit={handleSubmit} />
                </div>
              </>
            )}

            {phase === "loading" && <LoadingScreen />}

            {phase === "results" && (
              <ResultsPanel name={submittedName} onReset={() => setPhase("form")} />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
