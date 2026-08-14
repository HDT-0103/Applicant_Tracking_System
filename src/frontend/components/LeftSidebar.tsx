"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { D, Badge } from "../lib/shared";
import { 
  Layers, 
  FileText, 
  BarChart3, 
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
  Copy
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface JobPosting {
  id: string;
  title: string;
  status: string;
  applicant_count: number;
}

export const LeftSidebar: React.FC = () => {
  const router = useRouter();
  const [activeJobId, setActiveJobId] = useState<string>("");
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [hoveredJobId, setHoveredJobId] = useState<string | null>(null);
  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);

  const workspaceItems = [
    {
      icon: <Layers size={15} />,
      label: "Dashboard Overview",
      badge: null,
      path: "/",
    },
    {
      icon: <BarChart3 size={15} />,
      label: "Analytics & Insights",
      badge: "AI Live",
      path: "/analytics",
    },
    {
      icon: <FileText size={15} />,
      label: "CV Ingestion & Screening",
      badge: null,
      path: "/",
    },
  ];

  useEffect(() => {
    const loadJobPostings = async () => {
      try {
        const { data, error } = await supabase
          .from('jobs_posting')
          .select('id, job_title, status')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const { data: appCounts, error: appError } = await supabase
          .from('applications')
          .select('job_posting_id')
          .not('job_posting_id', 'is', null);

        if (appError) throw appError;

        const countMap: Record<string, number> = {};
        (appCounts || []).forEach((a) => {
          countMap[a.job_posting_id] = (countMap[a.job_posting_id] || 0) + 1;
        });

        const mapped: JobPosting[] = (data || []).map((job) => ({
          id: job.id,
          title: job.job_title,
          status: job.status,
          applicant_count: countMap[job.id] || 0,
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
    try {
      const { error } = await supabase
        .from('jobs_posting')
        .update({ status: newStatus })
        .eq('id', job.id);

      if (error) throw error;

      setJobPostings((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j))
      );
    } catch (err) {
      console.error('Failed to update job status:', err);
    } finally {
      setOpenMenuJobId(null);
    }
  };

  const handleDuplicateJob = async (e: React.MouseEvent, job: JobPosting) => {
    e.stopPropagation();
    try {
      const { data: original, error: fetchErr } = await supabase
        .from('jobs_posting')
        .select('*')
        .eq('id', job.id)
        .single();

      if (fetchErr || !original) throw fetchErr;

      const { id, created_at, last_saved_at, ...rest } = original;
      const copyPayload = {
        ...rest,
        job_title: `${original.job_title} (Copy)`,
        status: 'DRAFT',
        created_at: new Date().toISOString(),
        last_saved_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('jobs_posting')
        .insert(copyPayload)
        .select('id, job_title, status')
        .single();

      if (insertErr || !inserted) throw insertErr;

      setJobPostings((prev) => [
        { id: inserted.id, title: inserted.job_title, status: inserted.status, applicant_count: 0 },
        ...prev,
      ]);
    } catch (err) {
      console.error('Failed to duplicate job posting:', err);
    } finally {
      setOpenMenuJobId(null);
    }
  };

  const handleDeleteJob = async (e: React.MouseEvent, job: JobPosting) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the job posting "${job.title}"?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('jobs_posting')
        .delete()
        .eq('id', job.id);

      if (error) throw error;

      setJobPostings((prev) => prev.filter((j) => j.id !== job.id));
    } catch (err) {
      console.error('Failed to delete job posting:', err);
    } finally {
      setOpenMenuJobId(null);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%", 
      overflow: "hidden", 
      background: D.canvas,
      borderRight: `1px solid ${D.line}`,
      width: 280,
      flexShrink: 0
    }}>
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: item.label.includes("Analytics") ? `${D.purple}08` : "transparent",
                  border: item.label.includes("Analytics") ? `1px solid ${D.purple}20` : "1px solid transparent"
                }}
              >
                <div style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: 6, 
                  background: item.label === "CV Analysis" ? D.blue : D.surface,
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <div style={{ color: item.label === "CV Analysis" ? "#fff" : D.sub }}>
                    {item.icon}
                  </div>
                </div>
                <span style={{ 
                  fontSize: 12.5, 
                  fontWeight: 500, 
                  color: item.label === "CV Analysis" ? D.blue : D.sub,
                  flex: 1
                }}>
                  {item.label}
                </span>
                {item.badge && (
                  <Badge 
                    color={item.badge === "Active" ? D.blue : D.purple} 
                    bg={item.badge === "Active" ? D.blueSoft : `${D.purple}15`}
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
            JOB POSTINGS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {jobPostings.map((job) => {
              const isHovered = hoveredJobId === job.id;
              const isMenuOpen = openMenuJobId === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => router.push(`/careers/${encodeURIComponent(job.title)}`)}
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
                    background: activeJobId === job.id ? `${D.blue}08` : isHovered ? `${D.surface}` : "transparent",
                    border: activeJobId === job.id ? `1px solid ${D.blue}20` : "1px solid transparent",
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
                  }} title={`Status: ${job.status}`} />
                  
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
                    background: job.applicant_count > 0 ? `${D.blue}10` : D.surface,
                    border: job.applicant_count > 0 ? `1px solid ${D.blue}25` : `1px solid ${D.line}`,
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
                      title="Job options"
                    >
                      <MoreVertical size={14} />
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
                        background: "#ffffff",
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f5f7")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Pencil size={13} color={D.sub} />
                        <span>Edit Position</span>
                      </button>

                      {/* Option 2: View Public Portal */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuJobId(null);
                          router.push(`/careers/${encodeURIComponent(job.title)}`);
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f5f7")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <ExternalLink size={13} color={D.sub} />
                        <span>View Public Portal</span>
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f5f7")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {job.status === "PUBLISHED" ? (
                          <>
                            <PauseCircle size={13} color="#eab308" />
                            <span>Pause Applications</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle size={13} color="#10b981" />
                            <span>Resume Applications</span>
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f5f7")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Copy size={13} color={D.sub} />
                        <span>Duplicate Posting</span>
                      </button>

                      <div style={{ height: 1, background: D.line, margin: "2px 0" }} />

                      {/* Option 5: Delete Job Posting */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteJob(e, job)}
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
                          color: "#ef4444",
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Trash2 size={13} color="#ef4444" />
                        <span>Delete Job Posting</span>
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
            e.currentTarget.style.background = `${D.blue}08`;
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
          <span>Create Job Posting</span>
        </button>
      </div>
    </div>
  );
};
