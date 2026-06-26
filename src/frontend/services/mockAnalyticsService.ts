import { CandidateAnalytics } from "../../context/WorkspaceContext";

const Mock_Candidate: CandidateAnalytics = {
uuid: "candidate-8sd313",
fullName: "Alex M. Richardson",
title: "Senior Backend Engineer",
location: "San Francisco, CA",
affinityScore: 87.4,
matchConfidence: "High",
matchPercentile: 91,
breakdown: { experience: 91, skillsFit: 84, culture: 79 },
skills: [
    { name: "Backend", score: 88 },
    { name: "Frontend", score: 62 },
    { name: "Cloud Dev", score: 75 },
    { name: "InfoSec", score: 54 },
    { name: "ML / AI", score: 71 },
],
trajectory: [
    {
    year: 2024,
    role: "Senior Backend Engineer",
    company: "Nexus Systems Ltd.",
    period: "Jan 2024 — Present",
    highlight: "Microservices for 2M+ API requests · P95 latency −43%",
    isCurrent: true,
    type: "work",
    },
    {
    year: 2022,
    role: "Backend Engineer",
    company: "DataBridge Inc.",
    period: "Mar 2022 — Dec 2023",
    highlight: "Apache Spark pipelines · 500 GB/day throughput",
    isCurrent: false,
    type: "work",
    },
    {
      year: 2020,
      role: "Junior Software Developer",
      company: "TechStack Labs",
      period: "Jun 2020 — Feb 2022",
      highlight: "FastAPI · REST API design · 80K DAU",
      isCurrent: false,
      type: "work",
    },
    {
      year: 2014,
      role: "B.Sc. Computer Science",
      company: "University of Science & Technology",
      period: "2014 — 2018",
      highlight: "GPA 3.87 · Dean's List · Distributed Consensus Algorithms",
      isCurrent: false,
      type: "edu",
    },
  ],
  appliedRole: "Sr. Backend Engineer",
  appliedDate: "June 12, 2026",
  source: "LinkedIn Recruiter",
  seniority: "L5 / Staff",
  assessmentStatus: "Technical Assessment Pass",
  department: "Platform Engineering",
};

export async function mockAnalyticsService(_file:File): Promise<CandidateAnalytics>{
    return new Promise((resolve) => setTimeout(() => resolve(Mock_Candidate),2500));
}