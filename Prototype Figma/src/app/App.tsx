import { useState, useRef, useCallback } from "react";
import HRDashboard from "./HRDashboard";
import {
  Upload,
  FileText,
  X,
  Github,
  Linkedin,
  Twitter,
  Globe,
  Link2,
  MapPin,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Star,
  GitFork,
  Users,
  BookOpen,
  ExternalLink,
  ChevronDown,
  Search,
  Check,
  GraduationCap,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { Checkbox } from "./components/ui/checkbox";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./components/ui/command";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  twitter: string;
  github: string;
  website: string;
  otherSite: string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Mock enrichment data
const GH = {
  username: "nguyenthanhdat",
  name: "Thanh Dat Nguyen",
  followers: 218, following: 64, repos: 27,
  languages: [
    { name: "Python", pct: 38, color: "#3572A5" },
    { name: "Swift", pct: 24, color: "#F05138" },
    { name: "Kotlin", pct: 19, color: "#7F52FF" },
    { name: "Shell", pct: 12, color: "#89e051" },
    { name: "Other", pct: 7, color: "#8b8fa8" },
  ],
  repoList: [
    { name: "ios-forensics-toolkit", desc: "Python toolset for extracting and analysing iOS filesystem artefacts", stars: 184, forks: 31, lang: "Python", langColor: "#3572A5", updated: "5 days ago" },
    { name: "android-memory-dump", desc: "ADB-based utility for capturing volatile memory on Android devices", stars: 97, forks: 14, lang: "Kotlin", langColor: "#7F52FF", updated: "2 weeks ago" },
    { name: "mobile-malware-sandbox", desc: "Lightweight dynamic analysis sandbox for APK and IPA files", stars: 73, forks: 9, lang: "Python", langColor: "#3572A5", updated: "1 month ago" },
  ],
};

const LI = {
  name: "Thanh Dat Nguyen", initials: "TN",
  headline: "Mobile Security Intern · Digital Forensics Researcher · HCMUT 26",
  location: "Ho Chi Minh City, Vietnam", connections: "320+",
  experience: [
    { company: "Viettel Cybersecurity", role: "Security Research Intern", period: "Jun 2025 – Aug 2025", duration: "3 mo", desc: "Analysed Android malware samples using dynamic sandboxing. Contributed to internal threat intelligence reports." },
    { company: "HCMUT Security Lab", role: "Undergraduate Researcher", period: "Jan 2024 – Present", duration: "1 yr 6 mo", desc: "Research on iOS forensic artefact extraction. Published one workshop paper at ARES 2025." },
  ],
  education: [
    { school: "Ho Chi Minh City University of Technology (HCMUT)", degree: "B.Eng. Computer Engineering – Information Security", period: "2022 – 2026" },
  ],
};

const JD_REQUIREMENTS = [
  { heading: "Mobile Forensics & Analysis", items: ["iOS / Android filesystem artefact extraction", "Memory acquisition and analysis", "App data reverse engineering", "Digital evidence chain of custody"] },
  { heading: "Security Research Skills", items: ["Static & dynamic malware analysis", "Binary reverse engineering (Ghidra, Frida)", "OWASP Mobile Top-10 familiarity", "Vulnerability research fundamentals"] },
  { heading: "Programming & Tooling", items: ["Python scripting for automation", "Swift / Kotlin / Java familiarity", "ADB / libimobiledevice toolchains", "Git version control"] },
  { heading: "Academic Requirements", items: ["Enrolled in CS / InfoSec / CE programme", "Graduating Sept 2026 – Aug 2027", "Eligible to work in Vietnam (on-site)", "Available for 4-month internship term"] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1 flex-wrap">
      {children}
      {required && <span className="text-destructive text-xs leading-none">*</span>}
    </Label>
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

// ─── University Searchable Select ─────────────────────────────────────────────

function UniversitySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border bg-white px-3 h-10 text-left text-sm transition-all outline-none",
            open ? "ring-2 ring-[#4f46e5]/25 border-[#4f46e5]" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]",
          )}>
          <GraduationCap className="w-4 h-4 shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 truncate text-sm", !value && "text-muted-foreground")}>
            {value || "Select a university or college"}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-none" align="start" sideOffset={4}>
        <Command>
          <div className="flex items-center border-b px-3 gap-2">
            <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
            <CommandInput placeholder="Search institutions…" className="border-0 h-10 text-sm" />
          </div>
          <CommandList className="max-h-[260px]">
            <CommandEmpty className="py-4 text-sm text-center text-muted-foreground">No institution found.</CommandEmpty>
            <CommandGroup>
              {UNIVERSITIES.map((uni) => (
                <CommandItem key={uni} value={uni} onSelect={() => { onChange(uni); setOpen(false); }} className="cursor-pointer text-sm">
                  <Check className={cn("mr-2 h-4 w-4 text-[#4f46e5] shrink-0", value === uni ? "opacity-100" : "opacity-0")} />
                  {uni}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

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

// ─── Application Form ─────────────────────────────────────────────────────────

const emptyForm = (): FormData => ({
  resume: null, fullName: "", pronouns: "", customPronoun: "", email: "", phone: "",
  location: "", company: "", linkedin: "", twitter: "", github: "", website: "",
  otherSite: "", workEligibility: "", officeAttendance: "", university: "", faculty: "",
  gradYear: "", availableAgain: "", hearAbout: "", talentNetwork: "", startInPerson: "",
  anythingElse: "", ageGroup: "", genderIdentity: "", race: [], military: "", disability: "",
});

function ApplicationForm({ onSubmit }: { onSubmit: (d: FormData) => void }) {
  const [form, setForm] = useState<FormData>(emptyForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") set("resume", f);
  }, []);

  const baseCls = "h-10 rounded-md border text-sm transition-all outline-none focus:ring-2 focus:ring-[#4f46e5]/25 focus:border-[#4f46e5]";
  const inputCls = (err?: string) => cn(baseCls, err ? "border-destructive bg-red-50" : "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]");
  const selectCls = (err?: string) => cn("h-10 rounded-md border text-sm", err ? "border-destructive" : "border-[rgba(15,17,23,0.15)]");

  const socialLinks = [
    { key: "linkedin" as const, label: "LinkedIn URL", icon: <Linkedin className="w-4 h-4 text-[#0a66c2]" />, ph: "linkedin.com/in/your-profile" },
    { key: "twitter" as const, label: "Twitter URL", icon: <Twitter className="w-4 h-4 text-[#1d9bf0]" />, ph: "twitter.com/yourhandle" },
    { key: "github" as const, label: "GitHub URL", icon: <Github className="w-4 h-4 text-[#24292e]" />, ph: "github.com/yourusername" },
    { key: "website" as const, label: "Website, Blog or Portfolio URL", icon: <Globe className="w-4 h-4 text-[#4f46e5]" />, ph: "https://yoursite.com" },
    { key: "otherSite" as const, label: "Other website", icon: <Link2 className="w-4 h-4 text-muted-foreground" />, ph: "" },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">

      {/* SECTION 1 – CORE PROFILE */}
      <section>
        <SectionHeading label="Submit Your Application" />

        {/* Resume upload */}
        <div className="mb-6">
          <FieldLabel required>Resume / CV</FieldLabel>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) set("resume", f); }} />
          {form.resume ? (
            <div className="flex items-center gap-3 p-3 rounded-md border border-[#4f46e5]/30 bg-[#f5f3ff]">
              <div className="w-9 h-9 rounded-lg bg-[#4f46e5]/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[#4f46e5]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{form.resume.name}</p>
                <p className="text-xs text-muted-foreground">{(form.resume.size / 1024).toFixed(0)} KB · PDF</p>
              </div>
              <button type="button" onClick={() => { set("resume", null); if (fileRef.current) fileRef.current.value = ""; }}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={handleDrop} onClick={() => fileRef.current?.click()}
              className={cn(
                "flex items-center gap-4 rounded-md border-2 border-dashed px-5 py-5 cursor-pointer transition-all",
                drag ? "border-[#4f46e5] bg-[#f5f3ff]" : errors.resume
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
          <FieldError msg={errors.resume} />
        </div>

        {/* Full name */}
        <div className="mb-5">
          <FieldLabel htmlFor="fullName" required>Full name</FieldLabel>
          <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls(errors.fullName)} />
          <FieldError msg={errors.fullName} />
        </div>

        {/* Pronouns */}
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
            <Input placeholder="Enter your preferred pronouns" value={form.customPronoun}
              onChange={(e) => set("customPronoun", e.target.value)} className={inputCls() + " mt-1"} />
          )}
          <p className="text-xs text-muted-foreground mt-2">Optional: let us know your preferred pronouns</p>
        </div>

        {/* Email */}
        <div className="mb-5">
          <FieldLabel htmlFor="email" required>Email</FieldLabel>
          <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls(errors.email)} />
          <FieldError msg={errors.email} />
        </div>

        {/* Phone */}
        <div className="mb-5">
          <FieldLabel htmlFor="phone" required>Phone</FieldLabel>
          <Input id="phone" type="tel" placeholder="+84 (0) 90 000 0000" value={form.phone}
            onChange={(e) => set("phone", e.target.value)} className={inputCls(errors.phone)} />
          <FieldError msg={errors.phone} />
        </div>

        {/* Location */}
        <div className="mb-5">
          <FieldLabel htmlFor="location">Current location</FieldLabel>
          <Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls()} />
        </div>

        {/* Company */}
        <div>
          <FieldLabel htmlFor="company">Current company</FieldLabel>
          <Input id="company" value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls()} />
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
              <Input value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={ph}
                className={cn(baseCls, "border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)]")} />
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 – INTERN PROGRAM QUESTIONS */}
      <section>
        <SectionHeading label="Application Questions" />
        <div className="flex flex-col gap-6">

          {/* Q1 */}
          <div>
            <FieldLabel required>Are you legally entitled to work in the location of this job posting?</FieldLabel>
            <Select value={form.workEligibility} onValueChange={(v) => set("workEligibility", v)}>
              <SelectTrigger className={selectCls(errors.workEligibility)}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fulltime">Full-time eligibility</SelectItem>
                <SelectItem value="parttime">Part-time eligibility</SelectItem>
                <SelectItem value="pgwp">PGWP processing</SelectItem>
                <SelectItem value="not-eligible">Not eligible</SelectItem>
              </SelectContent>
            </Select>
            <FieldError msg={errors.workEligibility} />
          </div>

          {/* Q2 */}
          <div>
            <FieldLabel required>
              We have an in-person office attendance policy. Are you able to be in the location of this position by the start date?
            </FieldLabel>
            <RadioGroup value={form.officeAttendance} onValueChange={(v) => set("officeAttendance", v)} className="flex flex-col gap-2 mt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <RadioGroupItem value="yes" className="mt-0.5 shrink-0" />
                <span className="text-sm text-foreground leading-snug">Yes, I am able to work in-person at the office location posted</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <RadioGroupItem value="no" className="mt-0.5 shrink-0" />
                <span className="text-sm text-foreground leading-snug">I will not be able to work in the office of the location posted</span>
              </label>
            </RadioGroup>
            <FieldError msg={errors.officeAttendance} />
          </div>

          {/* Q3 */}
          <div>
            <FieldLabel required>
              University / College{" "}
              <span className="text-muted-foreground font-normal text-xs">(if your school is not there, please fill in the next question)</span>
            </FieldLabel>
            <UniversitySelect value={form.university} onChange={(v) => set("university", v)} />
            <FieldError msg={errors.university} />
          </div>

          {/* Q4 */}
          <div>
            <FieldLabel htmlFor="faculty">
              Please add your faculty, program or co-op department{" "}
              <span className="text-muted-foreground font-normal text-xs">(E.G. "SFU BA Psychology Honours" ... E.G. "Stanford Physics Co-op")</span>
            </FieldLabel>
            <Textarea id="faculty" rows={3} value={form.faculty} onChange={(e) => set("faculty", e.target.value)}
              className="rounded-md border border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)] focus:ring-2 focus:ring-[#4f46e5]/25 focus:border-[#4f46e5] text-sm transition-all outline-none resize-none" />
          </div>

          {/* Q5 */}
          <div>
            <FieldLabel required>What is your expected graduation year?</FieldLabel>
            <Select value={form.gradYear} onValueChange={(v) => set("gradYear", v)}>
              <SelectTrigger className={selectCls(errors.gradYear)}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently graduated</SelectItem>
                <SelectItem value="sept-2026">Sept 2026</SelectItem>
                <SelectItem value="dec-2026">Dec 2026</SelectItem>
                <SelectItem value="may-2027">May 2027</SelectItem>
                <SelectItem value="aug-2027">August 2027</SelectItem>
                <SelectItem value="dec-2027">Dec 2027</SelectItem>
                <SelectItem value="2028-later">2028 or later</SelectItem>
              </SelectContent>
            </Select>
            <FieldError msg={errors.gradYear} />
          </div>

          {/* Q6 */}
          <div>
            <FieldLabel required>Are you potentially available for another internship term after this one?</FieldLabel>
            <Select value={form.availableAgain} onValueChange={(v) => set("availableAgain", v)}>
              <SelectTrigger className={selectCls(errors.availableAgain)}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes-definitely">Yes, definitely</SelectItem>
                <SelectItem value="yes-possibly">Yes, possibly</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="unsure">Not sure yet</SelectItem>
              </SelectContent>
            </Select>
            <FieldError msg={errors.availableAgain} />
          </div>

          {/* Q7 */}
          <div>
            <FieldLabel required>Where did you hear about this position?</FieldLabel>
            <Select value={form.hearAbout} onValueChange={(v) => set("hearAbout", v)}>
              <SelectTrigger className={selectCls(errors.hearAbout)}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="company-website">Company Website</SelectItem>
                <SelectItem value="referral">Employee Referral</SelectItem>
                <SelectItem value="job-board">Job Board (Indeed, Glassdoor…)</SelectItem>
                <SelectItem value="university">University / Career Fair</SelectItem>
                <SelectItem value="social-media">Social Media</SelectItem>
                <SelectItem value="geocomply-network">GeoComply Talent Network</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FieldError msg={errors.hearAbout} />
          </div>

          {/* Q8 */}
          <div>
            <FieldLabel required>Are you part of GeoComply's Preferred Talent Network?</FieldLabel>
            <Select value={form.talentNetwork} onValueChange={(v) => set("talentNetwork", v)}>
              <SelectTrigger className={selectCls(errors.talentNetwork)}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="not-sure">I'm not sure</SelectItem>
              </SelectContent>
            </Select>
            <FieldError msg={errors.talentNetwork} />
          </div>

          {/* Q9 */}
          <div>
            <FieldLabel required>Can you start in-person at the location of this internship as of the start date?</FieldLabel>
            <RadioGroup value={form.startInPerson} onValueChange={(v) => set("startInPerson", v)} className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <RadioGroupItem value="yes" />
                <span className="text-sm text-foreground">Yes</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <RadioGroupItem value="no" />
                <span className="text-sm text-foreground">No</span>
              </label>
            </RadioGroup>
            <FieldError msg={errors.startInPerson} />
          </div>

          {/* Optional textarea */}
          <div>
            <FieldLabel htmlFor="anythingElse">
              Anything else we should know? :){" "}
              <span className="font-normal text-muted-foreground">(Optional)</span>
            </FieldLabel>
            <Textarea id="anythingElse" rows={4} value={form.anythingElse}
              onChange={(e) => set("anythingElse", e.target.value)}
              className="rounded-md border border-[rgba(15,17,23,0.15)] hover:border-[rgba(15,17,23,0.3)] focus:ring-2 focus:ring-[#4f46e5]/25 focus:border-[#4f46e5] text-sm transition-all outline-none resize-none" />
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

          {/* Age group */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Which age group do you belong to?</p>
            <RadioGroup value={form.ageGroup} onValueChange={(v) => set("ageGroup", v)} className="flex flex-col gap-2">
              {["Under 21", "21-29", "30-39", "40-49", "50-59", "60-69", "70+"].map((age) => (
                <label key={age} className="flex items-center gap-2.5 cursor-pointer">
                  <RadioGroupItem value={age} />
                  <span className="text-sm text-foreground">{age}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Gender */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">What gender do you identify as?</p>
            <RadioGroup value={form.genderIdentity} onValueChange={(v) => set("genderIdentity", v)} className="flex flex-col gap-2">
              {["Female", "Gender fluid", "Male", "Non-binary", "Two-spirit"].map((g) => (
                <label key={g} className="flex items-center gap-2.5 cursor-pointer">
                  <RadioGroupItem value={g} />
                  <span className="text-sm text-foreground">{g}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Race */}
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              How would you best describe your race?{" "}
              <span className="font-normal text-muted-foreground">(Please select all that apply)</span>
            </p>
            <div className="flex flex-col gap-2 mt-3">
              {RACE_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox id={`race-${value}`} checked={form.race.includes(value)}
                    onCheckedChange={() => toggleRace(value)}
                    className="border-[rgba(15,17,23,0.25)] data-[state=checked]:bg-[#4f46e5] data-[state=checked]:border-[#4f46e5]" />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Military */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Have you ever served on active duty in the military?</p>
            <RadioGroup value={form.military} onValueChange={(v) => set("military", v)} className="flex flex-col gap-2">
              {[
                "Currently on active duty",
                "Never served in the military",
                "Only on active duty for training in the Reserves or National Guard",
                "On active duty in the past, but not currently",
              ].map((m) => (
                <label key={m} className="flex items-start gap-2.5 cursor-pointer">
                  <RadioGroupItem value={m} className="mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground leading-snug">{m}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Disability */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Do you consider yourself to have a condition, impairment, or disability?</p>
            <RadioGroup value={form.disability} onValueChange={(v) => set("disability", v)} className="flex flex-col gap-2">
              {["No disability", "Physical disability", "Learning disability", "Mental disability", "Multiple disabilities"].map((d) => (
                <label key={d} className="flex items-center gap-2.5 cursor-pointer">
                  <RadioGroupItem value={d} />
                  <span className="text-sm text-foreground">{d}</span>
                </label>
              ))}
            </RadioGroup>
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
          Jobs powered by <span className="font-semibold text-foreground tracking-tight">lever</span>
        </p>
      </div>
    </form>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

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

// ─── Results Panel ────────────────────────────────────────────────────────────

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
        {/* GitHub */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d1117] flex items-center justify-center">
                <Github className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{GH.name}</p>
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>@{GH.username}</p>
              </div>
            </div>
            <a href="#" className="flex items-center gap-1 text-xs text-[#4f46e5] hover:underline">View <ExternalLink className="w-3 h-3" /></a>
          </div>
          <div className="p-5 flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-2">
              {[{ l: "Repos", v: GH.repos }, { l: "Followers", v: GH.followers }, { l: "Following", v: GH.following }].map((s) => (
                <div key={s.l} className="rounded-lg bg-[#f8f9fb] px-3 py-2.5 text-center border border-border">
                  <p className="text-lg font-semibold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            <div>
              <MicroLabel>Top Languages</MicroLabel>
              <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
                {GH.languages.map((l) => (
                  <div key={l.name} style={{ width: `${l.pct}%`, backgroundColor: l.color }} title={`${l.name}: ${l.pct}%`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {GH.languages.map((l) => (
                  <div key={l.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-xs text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{l.name}</span>
                    <span className="text-xs text-muted-foreground">{l.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <MicroLabel>Latest Repositories</MicroLabel>
              {GH.repoList.map((r, i) => (
                <div key={r.name} className={cn("py-3 flex flex-col gap-1", i < GH.repoList.length - 1 && "border-b border-border")}>
                  <div className="flex items-start justify-between gap-2">
                    <a href="#" className="text-sm font-semibold text-[#4f46e5] hover:underline leading-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.name}</a>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Star className="w-3 h-3" />{r.stars}</span>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><GitFork className="w-3 h-3" />{r.forks}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.langColor }} />
                    <span className="text-xs text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.lang}</span>
                    <span className="text-xs text-muted-foreground">· {r.updated}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LinkedIn */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0a66c2] flex items-center justify-center">
                <Linkedin className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">LinkedIn Profile</p>
            </div>
            <a href="#" className="flex items-center gap-1 text-xs text-[#4f46e5] hover:underline">View <ExternalLink className="w-3 h-3" /></a>
          </div>
          <div className="p-5 flex flex-col gap-5">
            <div className="flex gap-3 p-3.5 rounded-lg bg-[#f8f9fb] border border-border">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white font-bold">{LI.initials}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">{LI.name}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{LI.headline}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{LI.location}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3 h-3" />{LI.connections}</span>
                </div>
              </div>
            </div>
            <div>
              <MicroLabel>Work Experience</MicroLabel>
              <div className="relative">
                <div className="absolute left-[6px] top-2 bottom-2 w-px bg-[#4f46e5]/15" />
                <div className="flex flex-col">
                  {LI.experience.map((exp, i) => (
                    <div key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
                      <div className="w-3 h-3 rounded-full border-2 border-[#4f46e5] bg-white shrink-0 mt-0.5 z-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{exp.role}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{exp.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-[#4f46e5]" />
                          <p className="text-xs font-medium text-[#4f46e5]">{exp.company}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{exp.period}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{exp.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <MicroLabel>Education</MicroLabel>
              {LI.education.map((edu, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#f0f0ff] border border-[#e0e0ff] flex items-center justify-center shrink-0">
                    <BookOpen className="w-3.5 h-3.5 text-[#4f46e5]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{edu.school}</p>
                    <p className="text-xs text-muted-foreground">{edu.degree}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{edu.period}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Data sourced from public profiles only · Not shared with third parties · Handled per our Privacy Policy
      </p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

// The original candidate portal — preserved untouched
function CandidatePortal() {
  const [phase, setPhase] = useState<Phase>("form");
  const [submittedName, setSubmittedName] = useState("");

  const handleSubmit = (data: FormData) => {
    setSubmittedName(data.fullName);
    setPhase("loading");
    setTimeout(() => setPhase("results"), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fb]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", minWidth: 1100 }}>

      {/* Topnav */}
      <header className="h-12 bg-white border-b border-border flex items-center px-7 gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#4f46e5] flex items-center justify-center">
            <span className="text-white font-bold text-[9px] tracking-tight">GC</span>
          </div>
          <span className="text-sm font-semibold text-foreground">GeoComply</span>
        </div>
        <div className="w-px h-3.5 bg-border mx-1" />
        <span className="text-sm text-muted-foreground">Mobile Security Engineer Intern – Forensics</span>
        <div className="ml-auto">
          <a href="#" className="text-sm text-[#4f46e5] hover:underline font-medium">GeoComply Home Page</a>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[740px] mx-auto px-10 py-9">

            {phase === "form" && (
              <>
                <div className="mb-7">
                  <h2 className="text-xl font-semibold text-foreground tracking-tight">
                    Mobile Security Engineer Intern – Forensics
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ho Chi Minh, Vietnam &nbsp;·&nbsp; Technology – Engineering / Intern / On-site
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

// ─── View Switcher Root ───────────────────────────────────────────────────────
// This thin shell routes between the HR Admin Dashboard and the Candidate
// Portal. All code above (CandidatePortal and its sub-components) is untouched.

type RootView = "hr-dashboard" | "candidate-portal";

export default function App() {
  const [view, setView] = useState<RootView>("hr-dashboard");

  if (view === "hr-dashboard") {
    return (
      <HRDashboard
        onGoToPortal={() => setView("candidate-portal")}
      />
    );
  }

  return (
    <div className="relative">
      {/* Thin banner to navigate back to HR Admin */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2
          bg-[#4f46e5] text-white text-xs shadow-lg"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white/20 flex items-center justify-center">
            <span className="text-[8px] font-bold">GC</span>
          </div>
          <span className="font-medium">Candidate Portal Preview</span>
          <span className="opacity-60">— viewing as a job applicant</span>
        </div>
        <button
          onClick={() => setView("hr-dashboard")}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors font-medium"
        >
          ← Back to HR Dashboard
        </button>
      </div>
      {/* Offset the portal content so it clears the banner */}
      <div className="pt-8">
        <CandidatePortal />
      </div>
    </div>
  );
}
