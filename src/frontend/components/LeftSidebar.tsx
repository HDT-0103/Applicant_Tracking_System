"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { D, Badge, tint } from "../lib/shared";
import { 
  Layers, 
  BarChart3, 
  Search,
  Sparkles, 
  Calendar,
  Briefcase,
  ChevronRight,
  MoreVertical,
  Trash2,
  PauseCircle,
  PlayCircle,
  Pencil,
  ExternalLink,
  Copy,
  Pin,
  Link2,
} from "lucide-react";
import {
  deleteJobPosting,
  duplicateJobPosting,
  listJobPostings,
  setJobPostingStatus,
} from "../services/catalogService";
import { ConfirmDialog } from "./ConfirmDialog";
import { buildJobPath, buildJobUrl } from "../lib/jobUrl";
import { useT } from "../lib/i18n";

/** Bề rộng rail khi thu gọn — vừa đủ cho vùng bấm 36px và lề hai bên. */
const RAIL_WIDTH = 56;
/** Bề rộng khi bung. Giữ đúng 280 như cũ để nội dung bên trong không phải sửa. */
const PANEL_WIDTH = 280;
/** Ghi nhớ lựa chọn ghim giữa các lần mở lại trang. */
const PIN_STORAGE_KEY = "smartats.sidebar.pinned";

interface JobPosting {
  id: string;
  title: string;
  status: string;
  applicant_count: number;
}

export const LeftSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeJobId, setActiveJobId] = useState<string>("");
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);
  /** Tin tuyển dụng đang chờ xác nhận xoá. `null` = hộp thoại đóng. */
  const [deletingJob, setDeletingJob] = useState<JobPosting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Đọc trạng thái ghim sau khi mount, không đọc lúc khởi tạo state:
  // localStorage không tồn tại khi Next render phía server, và nếu server dựng
  // ra "thu gọn" còn client dựng ra "đã ghim" thì React báo lỗi hydration.
  useEffect(() => {
    setPinned(window.localStorage.getItem(PIN_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
  }, [pinned]);

  // "CV Ingestion & Screening" đã được gỡ: nó trỏ về "/" — đúng chỗ mà
  // "Dashboard Overview" ngay trên đó dẫn tới. Hai mục dẫn về cùng một trang
  // thì người dùng phải bấm cả hai mới biết, và mục thứ hai hứa một màn hình
  // không tồn tại. Việc nạp CV thực tế do ứng viên làm qua trang /careers.
  const workspaceItems = [
    {
      icon: <Layers size={15} />,
      label: t("sidebar.dashboardOverview"),
      badge: null,
      path: "/",
    },
    {
      icon: <Search size={15} />,
      label: t("sidebar.findCandidates"),
      badge: null,
      path: "/search",
    },
    {
      icon: <BarChart3 size={15} />,
      label: t("sidebar.analytics"),
      badge: t("sidebar.aiLive"),
      path: "/analytics",
    },
  ];

  /** Mục đang mở, xét theo URL thật.
   *
   *  Trước đây phần tô sáng so khớp nhãn với chuỗi "CV Analysis" — một nhãn
   *  không còn mục nào mang, nên KHÔNG BAO GIỜ có mục nào sáng lên và người
   *  dùng không đọc được mình đang ở đâu. */
  const isCurrent = (path: string) =>
    path === "/" ? pathname === "/" : pathname?.startsWith(path) ?? false;

  useEffect(() => {
    const loadJobPostings = async () => {
      try {
        // Qua backend: sidebar hiện ở MỌI trang, nên nó là truy vấn chạy nhiều
        // nhất trong app. Trước đây nó đọc thẳng Supabase bằng anon key và tự
        // đếm hồ sơ ứng tuyển ở phía trình duyệt.
        const jobs = await listJobPostings();
        const mapped: JobPosting[] = jobs.map((job) => ({
          id: job.id,
          title: job.job_title,
          status: job.status,
          applicant_count: job.applicant_count,
        }));

        setJobPostings(mapped);

        const firstPublished = mapped.find(j => j.status === 'PUBLISHED');
        if (firstPublished) {
          setActiveJobId(firstPublished.id);
        }
      } catch (err) {
        console.error('Failed to load job postings:', err);
        setJobPostings([]);
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobPostings();
  }, []);

  const handleToggleStatus = async (e: React.MouseEvent, job: JobPosting) => {
    e.stopPropagation();
    const newStatus = job.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED';
    setJobError(null);
    try {
      await setJobPostingStatus(job.id, newStatus);
      setJobPostings((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j))
      );
    } catch (err) {
      // Mở lại một tin chưa có hội đồng bị backend từ chối — người dùng cần
      // đọc được lý do, không phải thấy menu đóng lại và không có gì xảy ra.
      setJobError(
        err instanceof Error ? err.message : t("sidebar.statusError"),
      );
    } finally {
      setOpenMenuJobId(null);
    }
  };

  const handleDuplicateJob = async (e: React.MouseEvent, job: JobPosting) => {
    e.stopPropagation();
    setJobError(null);
    try {
      const copy = await duplicateJobPosting(job.id);
      setJobPostings((prev) => [
        { id: copy.id, title: copy.job_title, status: copy.status, applicant_count: 0 },
        ...prev,
      ]);
    } catch (err) {
      setJobError(
        err instanceof Error ? err.message : t("sidebar.duplicateError"),
      );
    } finally {
      setOpenMenuJobId(null);
    }
  };

  const askDeleteJob = (e: React.MouseEvent, job: JobPosting) => {
    e.stopPropagation();
    setJobError(null);
    setDeletingJob(job);
    setOpenMenuJobId(null);
  };

  const handleDeleteJob = async () => {
    const job = deletingJob;
    if (!job) return;
    setDeleting(true);
    setJobError(null);
    try {
      await deleteJobPosting(job.id);
      setJobPostings((prev) => prev.filter((j) => j.id !== job.id));
      setDeletingJob(null);
    } catch (err) {
      // Trước đây chỉ console.error: tin tuyển dụng vẫn nằm nguyên trong danh
      // sách và người dùng không có cách nào biết lệnh xoá đã hỏng.
      setJobError(
        err instanceof Error ? err.message : 'Could not delete this job posting.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // Panel bung ra ĐÈ LÊN nội dung thay vì đẩy nó sang phải: rail 56px luôn giữ
  // chỗ trong luồng layout, nên trang không nhảy mỗi lần chuột lướt qua.
  const expanded = isOpen || pinned;

  return (
    <>
    <ConfirmDialog
      open={deletingJob !== null}
      title={t("sidebar.delete.title")}
      message={
        <>
          <strong style={{ color: D.ink }}>{deletingJob?.title}</strong>{t("sidebar.delete.body")}
        </>
      }
      confirmLabel={t("sidebar.delete.confirm")}
      busy={deleting}
      onCancel={() => setDeletingJob(null)}
      onConfirm={handleDeleteJob}
    />
    <div
      style={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: "100%",
        position: "relative",
        zIndex: 40,
      }}
    >
    <div
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      // focus-within: người dùng bàn phím không có "hover". Không có nhánh này
      // thì tab vào sidebar sẽ đi qua các mục vô hình.
      onFocus={() => setIsOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOpen(false);
      }}
      style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      background: D.canvas,
      borderRight: `1px solid ${D.line}`,
      width: expanded ? PANEL_WIDTH : RAIL_WIDTH,
      position: "absolute",
      insetBlock: 0,
      insetInlineStart: 0,
      boxShadow: expanded && !pinned ? D.sh3 : "none",
      transition: `width 180ms ${D.ease}, box-shadow 180ms ${D.ease}`,
      flexShrink: 0
    }}>
      {/* Rail thu gọn — chỉ icon. Bấm ghim để khoá mở, dành cho người dùng
          bàn phím và màn hình cảm ứng (nơi không tồn tại khái niệm hover). */}
      {!expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 0", alignItems: "center" }}>
          {workspaceItems.map((item, index) => (
            <button
              type="button"
              key={index}
              onClick={() => router.push(item.path)}
              aria-label={item.label}
              aria-current={isCurrent(item.path) ? "page" : undefined}
              title={item.label}
              style={{
                width: 36, height: 36, display: "grid", placeItems: "center",
                borderRadius: D.r1, border: "none",
                background: isCurrent(item.path) ? D.blueSoft : "transparent",
                color: isCurrent(item.path) ? D.blue : D.sub,
                transition: `background 140ms ${D.ease}`,
              }}
            >
              {item.icon}
            </button>
          ))}
          <div style={{ width: 20, height: 1, background: D.lineSoft, margin: "6px 0" }} />
          <button
            type="button"
            onClick={() => router.push("/job-postings/create")}
            aria-label={t("sidebar.jobPostingsAria")}
            title={t("sidebar.jobPostingsAria")}
            style={{
              width: 36, height: 36, display: "grid", placeItems: "center",
              borderRadius: D.r1, border: "none", background: "transparent", color: D.sub,
            }}
          >
            <Briefcase size={15} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Nội dung đầy đủ — chỉ dựng khi mở, để rail thu gọn không có phần tử
          nào nhận được tab focus trong lúc bị ẩn. */}
      {expanded && (
      <>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 8px 0" }}>
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          aria-label={pinned ? t("sidebar.unpin") : t("sidebar.keepOpen")}
          aria-pressed={pinned}
          title={pinned ? t("sidebar.unpinShort") : t("sidebar.keepOpenShort")}
          style={{
            display: "grid", placeItems: "center", width: 26, height: 26,
            borderRadius: D.r1, border: "none",
            background: pinned ? D.blueSoft : "transparent",
            color: pinned ? D.blue : D.dim,
          }}
        >
          <Pin size={13} strokeWidth={2} />
        </button>
      </div>
      {/* Scrollable content */}
      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        overflowX: "hidden",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 20
      }}>
        {/* WORKSPACE Section */}
        <div>
          <div style={{ 
            fontSize: 9.5, 
            fontWeight: 700, 
            letterSpacing: "0.12em", 
            textTransform: "uppercase", 
            color: D.muted, 
            marginBottom: 10,
            paddingLeft: 4
          }}>
            WORKSPACE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {workspaceItems.map((item, index) => (
              <div
                key={index}
                onClick={() => router.push(item.path)}
                aria-current={isCurrent(item.path) ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: isCurrent(item.path) ? D.blueSoft : "transparent",
                  border: `1px solid ${isCurrent(item.path) ? `${tint("blue", "20")}` : "transparent"}`,
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: isCurrent(item.path) ? D.blue : D.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <div style={{ color: isCurrent(item.path) ? "#fff" : D.sub }}>
                    {item.icon}
                  </div>
                </div>
                <span style={{
                  fontSize: 12.5,
                  fontWeight: isCurrent(item.path) ? 600 : 500,
                  color: isCurrent(item.path) ? D.blue : D.sub,
                  flex: 1
                }}>
                  {item.label}
                </span>
                {item.badge && (
                  <Badge 
                    color={item.badge === "Active" ? D.blue : D.purple} 
                    bg={item.badge === "Active" ? D.blueSoft : `${tint("purple", "15")}`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* JOB POSTINGS Section */}
        <div>
          <div style={{ 
            fontSize: 9.5, 
            fontWeight: 700, 
            letterSpacing: "0.12em", 
            textTransform: "uppercase", 
            color: D.muted, 
            marginBottom: 10,
            paddingLeft: 4
          }}>
            {t("sidebar.jobPostings")}
          </div>
          {jobError && (
            <div
              role="alert"
              style={{
                marginBottom: 8,
                padding: "7px 9px",
                borderRadius: 5,
                background: `${tint("red", "0D")}`,
                border: `1px solid ${tint("red", "28")}`,
                color: D.red,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {jobError}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {jobPostings.map((job) => {
              const isHovered = hoveredJobId === job.id;
              const isMenuOpen = openMenuJobId === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => router.push(`/job-postings/${job.id}`)}
                  onMouseEnter={() => setHoveredJobId(job.id)}
                  onMouseLeave={() => {
                    setHoveredJobId(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: activeJobId === job.id ? `${tint("blue", "08")}` : isHovered ? `${D.surface}` : "transparent",
                    border: activeJobId === job.id ? `1px solid ${tint("blue", "20")}` : "1px solid transparent",
                    position: "relative"
                  }}
                >
                  {/* Active indicator line */}
                  {activeJobId === job.id && (
                    <div style={{
                      position: "absolute",
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      background: D.blue,
                      borderRadius: "0 2px 2px 0"
                    }} />
                  )}
                  
                  {/* Status indicator dot */}
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: "50%", 
                    background: job.status === "PUBLISHED" ? D.mint : D.muted,
                    flexShrink: 0,
                    marginLeft: activeJobId === job.id ? 4 : 0
                  }} title={t("sidebar.statusTitle", { status: t(`status.${job.status}`) })} />
                  
                  {/* Job title */}
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 500, 
                    color: activeJobId === job.id ? D.blue : D.sub,
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {job.title}
                  </span>
                  
                  {/* Applicant count badge */}
                  <div style={{
                    padding: "2px 6px",
                    borderRadius: 99,
                    background: job.applicant_count > 0 ? `${tint("blue", "10")}` : D.surface,
                    border: job.applicant_count > 0 ? `1px solid ${tint("blue", "25")}` : `1px solid ${D.line}`,
                    fontSize: 10,
                    fontWeight: 600,
                    color: job.applicant_count > 0 ? D.blue : D.muted,
                    fontFamily: "monospace",
                    flexShrink: 0
                  }}>
                    {job.applicant_count}
                  </div>

                  {/* 3-Dots Menu Button */}
                  {(isHovered || isMenuOpen) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuJobId(isMenuOpen ? null : job.id);
                      }}
                      style={{
                        padding: "3px",
                        borderRadius: 4,
                        background: isMenuOpen ? `${D.line}` : "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: D.sub,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                      // `title` shows a tooltip on hover but is NOT a reliable
                      // accessible name — a screen reader may ignore it, and a
                      // touch user never hovers. aria-label is what actually
                      // names the control; aria-expanded tells assistive tech
                      // whether the menu is currently open.
                      title={t("sidebar.jobOptions")}
                      aria-label={t("sidebar.optionsFor", { title: job.title })}
                      aria-haspopup="menu"
                      aria-expanded={openMenuJobId === job.id}
                    >
                      <MoreVertical size={14} aria-hidden="true" />
                    </button>
                  )}

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 36,
                        zIndex: 50,
                        background: D.canvas,
                        border: `1px solid ${D.line}`,
                        borderRadius: 8,
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                        padding: "4px",
                        minWidth: 175,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2
                      }}
                    >
                      {/* Option 1: Edit Position */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuJobId(null);
                          router.push(`/job-postings/create?id=${job.id}`);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: D.ink,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = D.surface)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Pencil size={13} color={D.sub} />
                        <span>{t("sidebar.editPosition")}</span>
                      </button>

                      {/* Option 2: View Public Portal */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuJobId(null);
                          // Link mang id: link theo tên chỉ khớp tin PUBLISHED
                          // (và chỉ khi tên là duy nhất).
                          router.push(buildJobPath(job.id, job.title));
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: D.ink,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = D.surface)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <ExternalLink size={13} color={D.sub} />
                        <span>{t("sidebar.viewPortal")}</span>
                      </button>

                      {/* Copy link: trước đây link chỉ hiện ở bước 3 của wizard
                          và trong modal publish, nên vào lại tin là "mất". */}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setOpenMenuJobId(null);
                          try {
                            await navigator.clipboard.writeText(buildJobUrl(job.id, job.title));
                          } catch {
                            /* clipboard bị chặn (http, iframe): mở trang chi tiết để copy tay */
                            router.push(`/job-postings/${job.id}`);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: D.ink,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = D.surface)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Link2 size={13} color={D.sub} />
                        <span>{t("sidebar.copyLink")}</span>
                      </button>

                      {/* Option 3: Pause / Resume Applications */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleStatus(e, job)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: D.ink,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = D.surface)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {job.status === "PUBLISHED" ? (
                          <>
                            <PauseCircle size={13} color="#eab308" />
                            <span>{t("sidebar.pause")}</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle size={13} color="#10b981" />
                            <span>{t("sidebar.resume")}</span>
                          </>
                        )}
                      </button>

                      {/* Option 4: Duplicate Posting */}
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateJob(e, job)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: D.ink,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = D.surface)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Copy size={13} color={D.sub} />
                        <span>{t("sidebar.duplicatePosting")}</span>
                      </button>

                      <div style={{ height: 1, background: D.line, margin: "2px 0" }} />

                      {/* Option 5: Delete Job Posting */}
                      <button
                        type="button"
                        onClick={(e) => askDeleteJob(e, job)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: D.red,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tint("red", "12"))}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Trash2 size={13} color={D.red} />
                        <span>{t("sidebar.deleteJob")}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom section - Add new job button */}
      <div style={{ 
        padding: "12px", 
        borderTop: `1px solid ${D.line}`,
        background: D.canvas
      }}>
        <button
          type="button"
          onClick={() => router.push('/job-postings/create')}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 6,
            background: D.surface,
            border: `1px solid ${D.line}`,
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 500,
            color: D.sub,
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${tint("blue", "08")}`;
            e.currentTarget.style.borderColor = D.blue;
            e.currentTarget.style.color = D.blue;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = D.surface;
            e.currentTarget.style.borderColor = D.line;
            e.currentTarget.style.color = D.sub;
          }}
        >
          <Briefcase size={14} strokeWidth={1.8} />
          <span>{t("sidebar.createJob")}</span>
        </button>
      </div>
      </>
      )}
    </div>
    </div>
    </>
  );
};
