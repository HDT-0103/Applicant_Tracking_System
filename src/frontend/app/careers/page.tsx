"use client";

import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { D } from "../../lib/shared";
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
  faculty: string;
  gradYear: string;
  availableAgain: string;
  hearAbout: string;
  talentNetwork: string;
  startInPerson: string;
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

const UNIVERSITIES = [
  "Massachusetts Institute of Technology (MIT)",
  "Stanford University",
  "Harvard University",
  "University of California, Berkeley",
  "Carnegie Mellon University",
  "University of Oxford",
  "University of Cambridge",
  "ETH Zurich",
  "National University of Singapore (NUS)",
  "Nanyang Technological University (NTU)",
  "University of Toronto",
  "University of Waterloo",
  "Tsinghua University",
  "Peking University",
  "Seoul National University",
  "The University of Tokyo",
  "Vietnam National University, Ho Chi Minh City",
  "Ho Chi Minh City University of Technology (HCMUT)",
  "University of Information Technology (UIT), VNU-HCM",
  "FPT University",
  "RMIT University Vietnam",
  "Hanoi University of Science and Technology",
  "University of Science, VNU-HCM",
  "Fulbright University Vietnam",
  "McGill University",
  "New York University (NYU)",
  "Columbia University",
  "Princeton University",
  "Yale University",
  "Georgia Institute of Technology",
  "University of Illinois Urbana-Champaign",
  "University of Michigan",
  "University of Edinburgh",
  "Imperial College London",
  "King's College London",
  "Delft University of Technology",
  "EPFL – Ecole Polytechnique Federale de Lausanne",
  "University of Melbourne",
  "University of Sydney",
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
  title: string;
  location: string;
  department: string;
  type: string;
  status: string;
  applicant_count: number;
  description: string;
  requirements: { must_have: string[]; nice_to_have: string[] };
  salary: string;
  posted_date: string;
}

interface JobPostingsData { jobs: JobPosting[]; }

const JD_REQUIREMENTS = [
  { heading: "Mobile Forensics & Analysis", items: ["iOS / Android filesystem artefact extraction", "Memory acquisition and analysis", "App data reverse engineering", "Digital evidence chain of custody"] },
  { heading: "Security Research Skills", items: ["Static & dynamic malware analysis", "Binary reverse engineering (Ghidra, Frida)", "OWASP Mobile Top-10 familiarity", "Vulnerability research fundamentals"] },
  { heading: "Programming & Tooling", items: ["Python scripting for automation", "Swift / Kotlin / Java familiarity", "ADB / libimobiledevice toolchains", "Git version control"] },
  { heading: "Academic Requirements", items: ["Enrolled in CS / InfoSec / CE programme", "Graduating Sept 2026 – Aug 2027", "Eligible to work in Vietnam (on-site)", "Available for 4-month internship term"] },
];

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
  const ref = useRef<HTMLDivElement>(null);

  const filtered = UNIVERSITIES.filter(u => u.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-4 text-sm text-center text-muted-foreground">No institution found.</p>
            )}
            {filtered.map((uni) => (
              <button key={uni} type="button" onClick={() => { onChange(uni); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[#f5f3ff] transition-colors text-left">
                <Check className={cn("w-4 h-4 text-[#4f46e5] shrink-0", value === uni ? "opacity-100" : "opacity-0")} />
                {uni}
              </button>
            ))}
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
    <div className="flex flex-col gap-7">
      <div className="rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#6d28d9] px-6 py-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">Application Submitted</p>
          <p className="text-sm text-white/70 mt-0.5">{name} — profile enrichment complete. Hiring team notified.</p>
        </div>
        <button onClick={onReset} className="text-xs text-white/60 hover:text-white transition-colors underline underline-offset-2 shrink-0">
          New application
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Profile Enrichment · Auto-collected from public sources
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d1117] flex items-center justify-center">
                <Github className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">GitHub Profile</p>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#f0f0f0] mx-auto flex items-center justify-center">
              <Github className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">GitHub enrichment data will appear here after processing.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0a66c2] flex items-center justify-center">
                <Linkedin className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">LinkedIn Profile</p>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#f0f0f0] mx-auto flex items-center justify-center">
              <Linkedin className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">LinkedIn enrichment data will appear here after processing.</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Data sourced from public profiles only · Not shared with third parties · Handled per our Privacy Policy
      </p>
    </div>
  );
}

function ApplicationForm({ onSubmit }: { onSubmit: (d: FormData) => void }) {
  const [form, setForm] = useState<FormData>({
    resume: null, fullName: "", pronouns: "", customPronoun: "", email: "", phone: "",
    location: "", company: "", linkedin: "", github: "", portfolio: "", website: "",
    workEligibility: "", officeAttendance: "", university: "", faculty: "",
    gradYear: "", availableAgain: "", hearAbout: "", talentNetwork: "", startInPerson: "",
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
    if (!form.university) e.university = "Please select your university";
    if (!form.gradYear) e.gradYear = "Please select your expected graduation year";
    if (!form.availableAgain) e.availableAgain = "Please select an option";
    if (!form.hearAbout) e.hearAbout = "Please select how you heard about this role";
    if (!form.talentNetwork) e.talentNetwork = "Please select an option";
    if (!form.startInPerson) e.startInPerson = "Please indicate if you can start in-person";
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

      {/* SECTION 3 – INTERN PROGRAM QUESTIONS */}
      <section>
        <SectionHeading label="Intern Program Questions 2026" />
        <div className="flex flex-col gap-6">

          <div>
            <FieldLabel required>Are you legally entitled to work in the location of this job posting?</FieldLabel>
            <div className="relative">
              <select value={form.workEligibility} onChange={(e) => set("workEligibility", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.workEligibility ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="fulltime">Full-time eligibility</option>
                <option value="parttime">Part-time eligibility</option>
                <option value="pgwp">PGWP processing</option>
                <option value="not-eligible">Not eligible</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.workEligibility} />
          </div>

          <div>
            <FieldLabel required>
              We have an in-person office attendance policy. Are you able to be in the location of this position by the start date?
            </FieldLabel>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="radio" name="officeAttendance" value="yes" checked={form.officeAttendance === "yes"}
                  onChange={(e) => set("officeAttendance", e.target.value)} className="mt-0.5 shrink-0 accent-[#4f46e5]" />
                <span className="text-sm text-foreground leading-snug">Yes, I am able to work in-person at the office location posted</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="radio" name="officeAttendance" value="no" checked={form.officeAttendance === "no"}
                  onChange={(e) => set("officeAttendance", e.target.value)} className="mt-0.5 shrink-0 accent-[#4f46e5]" />
                <span className="text-sm text-foreground leading-snug">I will not be able to work in the office of the location posted</span>
              </label>
            </div>
            <FieldError msg={errors.officeAttendance} />
          </div>

          <div>
            <FieldLabel required>
              University / College{" "}
              <span className="text-muted-foreground font-normal text-xs">(if your school is not there, please fill in the next question)</span>
            </FieldLabel>
            <UniversitySelect value={form.university} onChange={(v) => set("university", v)} error={errors.university} />
          </div>

          <div>
            <FieldLabel htmlFor="faculty">
              Please add your faculty, program or co-op department{" "}
              <span className="text-muted-foreground font-normal text-xs">(E.G. "SFU BA Psychology Honours" ... E.G. "Stanford Physics Co-op")</span>
            </FieldLabel>
            <textarea id="faculty" rows={3} value={form.faculty} onChange={(e) => set("faculty", e.target.value)} className={textareaCls} />
          </div>

          <div>
            <FieldLabel required>What is your expected graduation year?</FieldLabel>
            <div className="relative">
              <select value={form.gradYear} onChange={(e) => set("gradYear", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.gradYear ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="recent">Recently graduated</option>
                <option value="sept-2026">Sept 2026</option>
                <option value="dec-2026">Dec 2026</option>
                <option value="may-2027">May 2027</option>
                <option value="aug-2027">August 2027</option>
                <option value="dec-2027">Dec 2027</option>
                <option value="2028-later">2028 or later</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.gradYear} />
          </div>

          <div>
            <FieldLabel required>Are you potentially available for another internship term after this one?</FieldLabel>
            <div className="relative">
              <select value={form.availableAgain} onChange={(e) => set("availableAgain", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.availableAgain ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="yes-definitely">Yes, definitely</option>
                <option value="yes-possibly">Yes, possibly</option>
                <option value="no">No</option>
                <option value="unsure">Not sure yet</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <FieldError msg={errors.availableAgain} />
          </div>

          <div>
            <FieldLabel required>Where did you hear about this position?</FieldLabel>
            <div className="relative">
              <select value={form.hearAbout} onChange={(e) => set("hearAbout", e.target.value)}
                className={cn(baseCls, "w-full px-3 appearance-none cursor-pointer bg-white", errors.hearAbout ? "border-destructive" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")}>
                <option value="">Select…</option>
                <option value="linkedin">LinkedIn</option>
                <option value="company-website">Company Website</option>
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
            <FieldLabel required>Are you part of GeoComply's Preferred Talent Network?</FieldLabel>
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
            <FieldLabel required>Can you start in-person at the location of this internship as of the start date?</FieldLabel>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="startInPerson" value="yes" checked={form.startInPerson === "yes"}
                  onChange={(e) => set("startInPerson", e.target.value)} className="shrink-0 accent-[#4f46e5]" />
                <span className="text-sm text-foreground">Yes</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="startInPerson" value="no" checked={form.startInPerson === "no"}
                  onChange={(e) => set("startInPerson", e.target.value)} className="shrink-0 accent-[#4f46e5]" />
                <span className="text-sm text-foreground">No</span>
              </label>
            </div>
            <FieldError msg={errors.startInPerson} />
          </div>

          <div>
            <FieldLabel htmlFor="anythingElse">
              Anything else we should know? :){" "}
              <span className="font-normal text-muted-foreground">(Optional)</span>
            </FieldLabel>
            <textarea id="anythingElse" rows={4} value={form.anythingElse}
              onChange={(e) => set("anythingElse", e.target.value)} className={textareaCls} />
          </div>
        </div>
      </section>

      {/* SECTION 4 – DIVERSITY SURVEY */}
      <section>
        <SectionHeading label="Diversity Survey for GeoComply" />
        <div className="rounded-lg border border-[rgba(79,70,229,0.18)] bg-[#faf9ff] p-5 mb-7 text-sm text-foreground leading-relaxed">
          Diversity, equity, and inclusion are an important part of who we are at GeoComply. We strive to be reflective
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

function Sidebar() {
  return (
    <aside className="w-[320px] shrink-0 flex flex-col bg-white border-r border-border overflow-y-auto">
      <div className="px-7 pt-7 pb-6 border-b border-border">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#4f46e5] flex items-center justify-center">
            <span className="text-white font-bold text-[10px] tracking-tight">GC</span>
          </div>
          <span className="text-sm font-semibold text-foreground">GeoComply</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Hiring
          </span>
        </div>
        <h1 className="text-base font-semibold text-foreground leading-snug tracking-tight mb-2">
          Mobile Security Engineer Intern – Forensics
        </h1>
        <p className="text-xs text-muted-foreground">Ho Chi Minh, Vietnam</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["Technology – Engineering", "Intern", "On-site"].map((tag) => (
            <span key={tag} className="text-[11px] text-muted-foreground bg-[#f4f4f6] rounded px-2 py-0.5 border border-border">{tag}</span>
          ))}
        </div>
      </div>
      <div className="px-7 py-6 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-5">Job Requirements</p>
        <div className="flex flex-col gap-5">
          {JD_REQUIREMENTS.map((sec) => (
            <div key={sec.heading}>
              <p className="text-xs font-semibold text-foreground mb-2">{sec.heading}</p>
              <ul className="flex flex-col gap-1.5">
                {sec.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#4f46e5]/30 shrink-0" />
                    <span className="text-xs text-muted-foreground leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [jobData, setJobData] = useState<JobPostingsData | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [submittedName, setSubmittedName] = useState("");

  useEffect(() => {
    const loadJobData = async () => {
      try {
        const response = await fetch('/job_postings.json');
        if (!response.ok) throw new Error('Failed to fetch job postings');
        const data: JobPostingsData = await response.json();
        setJobData(data);
        if (jobId) {
          const job = data.jobs.find(j => j.id === jobId);
          setSelectedJob(job || data.jobs[0]);
        } else {
          const firstOpenJob = data.jobs.find(j => j.status === 'open');
          setSelectedJob(firstOpenJob || data.jobs[0]);
        }
      } catch (err) {
        console.error('Failed to load job data:', err);
        setError('Failed to load job postings');
      } finally {
        setLoading(false);
      }
    };
    loadJobData();
  }, [jobId]);

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

      if (!candidateUuid) {
        throw new Error('No candidate UUID returned from ingest API');
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
            <span className="text-white font-bold text-[9px] tracking-tight">GC</span>
          </div>
          <span className="text-sm font-semibold text-foreground">GeoComply</span>
        </div>
        <div className="w-px h-3.5 bg-border mx-1" />
        <span className="text-sm text-muted-foreground">{selectedJob?.title || "Careers"}</span>
        <div className="ml-auto">
          <a href="#" className="text-sm text-[#4f46e5] hover:underline font-medium">GeoComply Home Page</a>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
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
                    {selectedJob?.title || "Position"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedJob?.location || "Location"} &nbsp;·&nbsp; {selectedJob?.department || "Department"} / {selectedJob?.type || "Type"} / On-site
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
                  <ApplicationForm onSubmit={handleSubmit} />
                </div>
              </>
            )}

            {phase === "loading" && <LoadingScreen />}

            {phase === "results" && (
              <>
                <div className="mb-7">
                  <h2 className="text-xl font-semibold text-foreground tracking-tight">Application Review</h2>
                  <p className="text-sm text-muted-foreground mt-1">Profile enrichment complete. Here's what we collected from public sources.</p>
                </div>
                <ResultsPanel name={submittedName} onReset={() => setPhase("form")} />
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
