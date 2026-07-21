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
  ChevronRight
} from "lucide-react";

interface JobPosting {
  id: string;
  title: string;
  status: "open" | "draft";
  applicant_count: number;
}

interface JobPostingsData {
  jobs: JobPosting[];
}

export const LeftSidebar: React.FC = () => {
  const router = useRouter();
  const [activeJobId, setActiveJobId] = useState<string>("job-1");
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const workspaceItems = [
    { icon: <Layers size={14} strokeWidth={1.8} />, label: "Orchestra", badge: null },
    { icon: <FileText size={14} strokeWidth={1.8} />, label: "CV Analysis", badge: "Active" },
    { icon: <BarChart3 size={14} strokeWidth={1.8} />, label: "Semantic Ranking", badge: null },
    { icon: <Sparkles size={14} strokeWidth={1.8} />, label: "AI Assistant", badge: "Beta" },
    { icon: <Calendar size={14} strokeWidth={1.8} />, label: "Interview Scheduling", badge: null },
  ];

  // Load job postings from JSON file
  useEffect(() => {
    const loadJobPostings = async () => {
      try {
        const response = await fetch('/job_postings.json');
        if (!response.ok) {
          throw new Error('Failed to fetch job postings');
        }
        const data: JobPostingsData = await response.json();
        setJobPostings(data.jobs || []);
        
        // Set first open job as active
        const firstOpenJob = data.jobs?.find(j => j.status === 'open');
        if (firstOpenJob) {
          setActiveJobId(firstOpenJob.id);
        }
      } catch (err) {
        console.error('Failed to load job postings:', err);
        // Fallback to empty array
        setJobPostings([]);
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobPostings();
  }, []);

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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: item.label === "CV Analysis" ? `${D.blue}08` : "transparent",
                  border: item.label === "CV Analysis" ? `1px solid ${D.blue}20` : "1px solid transparent"
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
            {jobPostings.map((job) => (
              <div
                key={job.id}
                onClick={() => setActiveJobId(job.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: activeJobId === job.id ? `${D.blue}08` : "transparent",
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
                  background: job.status === "open" ? D.mint : D.muted,
                  flexShrink: 0,
                  marginLeft: activeJobId === job.id ? 4 : 0
                }} />
                
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
                  padding: "2px 8px",
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
              </div>
            ))}
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
