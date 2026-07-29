---
name: ats-business-domain
description: Comprehensive enterprise ATS business domain model covering candidate lifecycle, hiring pipeline, interview workflow, job posting lifecycle, offer process, and role-based operational workflows for SmartATS
version: 2.0.0
author: SmartATS Enterprise Architecture Team
tech_stack:
  - Enterprise ATS Domain Architecture
  - Supabase / PostgreSQL State Machine
  - FastAPI Workflow Services
  - Next.js 15 Workspace UI
when_to_use:
  - "understand ATS business domain rules and terminology"
  - "implement candidate status transition logic"
  - "design interview scheduling or feedback workflows"
  - "build job posting publishing and approval pipelines"
  - "enforce role-based operational permissions (Recruiter, Hiring Manager, Interviewer, Admin)"
---

# Enterprise ATS Business Domain & Workflow Framework

## 1. Executive Summary & Domain Scope

SmartATS is an AI-powered Enterprise Applicant Tracking System designed for modern engineering and talent acquisition teams. It bridges talent sourcing, AI resume parsing, candidate enrichment, structured interviews, and automated job offer pipelines.

AI coding agents MUST understand the business domain to prevent generating invalid state transitions, improper role checks, or non-compliant candidate workflows.

---

## 2. Core Business Entities & Relations

```
[Job Posting] ── (1:N) ──► [Application] ◄── (N:1) ── [Candidate]
      │                        │                            │
      ├── (1:N) ── [Candidate Review]               ├── (1:1) ── [CV / Resume]
      │                        │                            ├── (1:1) ── [GitHub Profile]
      └── (1:N) ── [Interview Schedule]             └── (1:1) ── [LinkedIn Profile]
                               │
                               └── (1:N) ── [Confirmed Slot / Feedback]
```

### Key Business Models
1. **Candidate (`candidates`)**: Represents a physical applicant with identity (email, phone, name), social profiles (LinkedIn, GitHub), and demographic metadata.
2. **Job Posting (`jobs_posting`)**: A requisition created by a hiring manager or recruiter (Draft, Published, Closed, Archived).
3. **Application (`applications`)**: The binding between a Candidate and a Job Posting containing stage status (`SUBMITTED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`).
4. **Enrichment Profile (`enrichment_profiles`)**: Multi-channel data extracted via Gemini AI, GitHub REST API, and LinkedIn scrapers.
5. **Interview Slot (`confirmed_slots`)**: Calendar-synchronized interview events linked to interviewers and candidates.

---

## 3. Candidate & Application Lifecycle State Machine

```
              ┌─────────────────────────────────────────────────────────┐
              │                                                         │
[Resume PDF] ─┴─► SUBMITTED ──► SCREENING ──► INTERVIEW ──► OFFER ──► HIRED
                    │               │             │           │
                    ├───────────────┴─────────────┴───────────┴─► REJECTED
                    │
                    └───────────────────────────────────────────► WITHDRAWN
```

### State Transition Rules
- `SUBMITTED`: Triggered automatically upon PDF upload via Careers Portal or Ingestion API.
- `SCREENING`: Set when Recruiter/HR Manager triggers AI enrichment or manually reviews CV.
- `INTERVIEW`: Set when Candidate is invited for technical/behavioral interview slots.
- `OFFER`: Triggered upon HR Approval of compensation package.
- `HIRED`: Final positive terminal state when candidate signs offer letter.
- `REJECTED`: Terminal state with documented rejection reason tag (`skills_mismatch`, `salary_expectation`, `culture_fit`, `no_show`).
- `WITHDRAWN`: Candidate voluntarily exits pipeline.

---

## 4. Role-Based Workflows & Operational Actors

| Role | Primary Responsibilities | Key UI / API Boundaries |
|------|--------------------------|------------------------|
| **Recruiter / HR Manager** | Post jobs, review applications, trigger AI enrichment, schedule interviews, initiate offers | Full pipeline access, Ingestion, Enrichment, Calendar Sync |
| **Hiring Manager / Tech Lead** | Define job requirements, review AI skill matrix, perform technical interviews, approve hiring recommendations | Candidate Profile, Radar Charts, Scorecards, Approval Queue |
| **Technical Interviewer** | Conduct technical evaluation, submit interview feedback | Assigned Candidate Slot, ABAC PII-masked view, Evaluation form |
| **System Admin** | Configure ABAC security rules, LLM token limits, user provisioning, system auditing | Admin Control Dashboard, Audit Logs, Rate limits |

---

## 5. Interview Workflow & Scorecards

1. **Scheduling**: Recruiter sends availability link or matches slots via `confirmed_slots` table.
2. **Conducting Interview**: Interviewers receive assigned candidate with PII fields masked (if ABAC policy requires).
3. **Scorecard Submission**: Structured feedback logged containing:
   - Technical rating (1–5)
   - Code quality & problem-solving score
   - Soft skills & communication score
   - Recommendation (`Strong Hire`, `Hire`, `No Hire`, `Strong No Hire`)

---

## 6. AI Agent Guidelines for Domain Logic

### When Should AI Load This Skill?
Load this skill when modifying candidate status transitions, designing job application APIs, implementing interview scheduling, or handling role-based business rules.

### Which Modules Depend On This?
- `modules/ingestion`: Sets initial `SUBMITTED` application status.
- `modules/enrichment`: Advances status to `SCREENING` and updates skill affinity.
- `modules/auth`: Enforces role-based permissions (`recruiter`, `hr_manager`, `tech_lead`, `admin`).

### What Files Should AI Modify vs Never Modify?
- **Allowed**: Domain services in `src/backend/modules/*/application/`, models in `domain/models.py`.
- **Never Modify**: Fixed state enum definitions without team approval (`public.application_status`).

### Common Implementation Mistakes & Anti-Patterns
- **Bypassing State Transitions**: Directly forcing an application from `SUBMITTED` to `HIRED` without passing through `INTERVIEW` or `OFFER`.
- **Hardcoding Roles**: Checking strings like `user.role == 'manager'` instead of using standard roles (`hr_manager`, `tech_lead`, `recruiter`, `admin`).
- **Ignoring Audit Trail**: Mutating application stage without logging who changed it and when.
