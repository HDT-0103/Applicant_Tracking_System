"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { D } from "../lib/shared";
import { useAuth } from "../contexts/AuthContext";
import { candidateDisplayName } from "../lib/candidateLabel";
import { isOperationalRole } from "../lib/rbac";
import { listCandidateOptions, listJobPostings } from "../services/catalogService";
import { useT } from "../lib/i18n";
import { CANDIDATE_OPTIONS_QUERY, JOB_POSTINGS_QUERY, fetchQuery } from "../lib/queryCache";

/**
 * Bảng lệnh ⌘K.
 *
 * Ô "Search candidates, roles, pipelines…" ở header từng là trang trí. Nay nó
 * mở bảng này: gõ để nhảy tới một ứng viên hoặc tin tuyển dụng TRONG PHẠM VI
 * của mình (dữ liệu lấy từ hai endpoint catalog đã lọc theo người gọi), hoặc
 * tới một màn hình. Tên ứng viên đi qua `candidateDisplayName`, nên tech lead
 * thấy `Candidate #1a2b3c4d` chứ không phải `***`.
 */
export interface PaletteItem {
  id: string;
  group: "Go to" | "Candidates" | "Job postings";
  label: string;
  hint?: string;
  href: string;
  Icon: typeof Search;
}

const GROUP_KEYS: Record<PaletteItem["group"], string> = {
  "Go to": "palette.group.goto",
  Candidates: "palette.group.candidates",
  "Job postings": "palette.group.jobs",
};

export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) => it.label.toLowerCase().includes(q) || (it.hint ?? "").toLowerCase().includes(q),
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [dynamic, setDynamic] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";
  const operational = isOperationalRole(user?.role);

  const staticItems = useMemo<PaletteItem[]>(() => {
    if (isAdmin) return [{ id: "admin", group: "Go to", label: t("nav.adminPanel"), href: "/admin", Icon: ShieldCheck },
      { id: "settings", group: "Go to", label: t("nav.settings"), href: "/settings", Icon: Settings }];
    return [
      { id: "dashboard", group: "Go to", label: t("nav.dashboard"), href: "/", Icon: LayoutDashboard },
      { id: "search", group: "Go to", label: t("nav.search"), href: "/search", Icon: Search },
      { id: "analytics", group: "Go to", label: t("nav.analytics"), href: "/analytics", Icon: BarChart3 },
      { id: "schedule", group: "Go to", label: t("nav.schedule"), href: "/schedule", Icon: CalendarDays },
      ...(user?.role === "hr"
        ? [{ id: "new-job", group: "Go to" as const, label: t("nav.newJob"), href: "/job-postings/create", Icon: Plus }]
        : []),
      { id: "settings", group: "Go to", label: t("nav.settings"), href: "/settings", Icon: Settings },
    ];
  }, [isAdmin, user?.role, t]);

  // Nạp ứng viên + tin khi mở lần đầu; hỏng thì bảng vẫn dùng được cho phần
  // điều hướng — đây là tiện nghi, không phải cổng.
  useEffect(() => {
    if (!open || !operational || dynamic.length > 0) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchQuery(CANDIDATE_OPTIONS_QUERY, listCandidateOptions),
      fetchQuery(JOB_POSTINGS_QUERY, listJobPostings),
    ])
      .then(([cands, jobs]) => {
        if (!alive) return;
        setDynamic([
          ...cands.map((c) => ({
            id: `cand-${c.candidate_uuid}`,
            group: "Candidates" as const,
            label: candidateDisplayName(c.full_name, c.candidate_uuid),
            href: `/candidate-profile/enriched?uuid=${c.candidate_uuid}`,
            Icon: User,
          })),
          ...jobs.map((j) => ({
            id: `job-${j.id}`,
            group: "Job postings" as const,
            label: j.job_title,
            hint: `${t(`status.${j.status}`)} · ${j.applicant_count === 1 ? t("palette.applicantOne") : t("palette.applicants", { n: j.applicant_count })}`,
            href: `/job-postings/${j.id}`,
            Icon: Briefcase,
          })),
        ]);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, operational, dynamic.length, t]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo(() => filterItems([...staticItems, ...dynamic], query), [staticItems, dynamic, query]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const go = (item: PaletteItem) => {
    onClose();
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[cursor]) go(items[cursor]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup: string | null = null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("palette.aria")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(5, 7, 12, 0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh",
      }}
    >
      <div
        style={{
          width: "min(560px, calc(100vw - 32px))",
          background: D.canvas,
          border: `1px solid ${D.line}`,
          borderRadius: 12,
          boxShadow: D.sh3,
          overflow: "hidden",
          fontFamily: D.font,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${D.line}` }}>
          <Search size={15} color={D.dim} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.searchAria")}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: D.ink, fontFamily: D.font }}
          />
          <kbd style={{ fontSize: 10, color: D.dim, border: `1px solid ${D.line}`, borderRadius: 4, padding: "1px 5px", fontFamily: D.mono }}>esc</kbd>
        </div>

        <div role="listbox" style={{ maxHeight: 380, overflowY: "auto", padding: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: 18, textAlign: "center", fontSize: 12.5, color: D.muted }}>
              {loading ? t("common.loading") : t("palette.nothing")}
            </div>
          )}
          {items.map((it, i) => {
            const showGroup = it.group !== lastGroup;
            lastGroup = it.group;
            const active = i === cursor;
            return (
              <React.Fragment key={it.id}>
                {showGroup && (
                  <div style={{ padding: "8px 10px 4px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.dim }}>
                    {t(GROUP_KEYS[it.group])}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(it)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "8px 10px", borderRadius: 7, border: "none", textAlign: "left",
                    background: active ? D.blueSoft : "transparent",
                    color: D.ink, fontSize: 13, cursor: "pointer", fontFamily: D.font,
                  }}
                >
                  <it.Icon size={14} color={active ? D.blue : D.muted} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                  {it.hint && <span style={{ fontSize: 11, color: D.dim }}>{it.hint}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
