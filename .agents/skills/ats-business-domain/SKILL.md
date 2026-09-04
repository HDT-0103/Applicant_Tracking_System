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
  - "enforce role-based operational permissions (Recruiter, HR, HR Manager, Tech Lead, Interviewer, Admin)"
---

# Enterprise ATS Business Domain & Workflow Framework

## 1. Executive Summary & Domain Scope

SmartATS is an AI-powered Enterprise Applicant Tracking System designed for modern engineering and talent acquisition teams. It bridges talent sourcing, AI resume parsing, candidate enrichment, structured interviews, and automated job offer pipelines.

AI coding agents MUST understand the business domain to prevent generating invalid state transitions, improper role checks, or non-compliant candidate workflows.

---

## 2. Core Business Entities & Relations

```
[Job Posting] ── (1:N) ──► [CandidateRecord] ◄── (N:1) ── [Candidate]
      │                        │                            │
      ├── (1:N) ── [Candidate Review]               ├── (1:1) ── [CV / Resume PDF]
      │                        │                            ├── (1:1) ── [GithubProfile]
      └── (1:N) ── [Interview Schedule]             └── (1:1) ── [LinkedinProfile]
                               │
                               └── (1:N) ── [EnrichedProfile Analytics]
```

### Key Business Models
1. **Candidate (`candidates`)**: Represents an applicant record with identity (email, phone, name), social profiles (LinkedIn, GitHub), and CV file path.
2. **Job Posting (`job_postings`)**: Requisitions created by hiring managers or recruiters (`job_id`).
3. **Candidate Record (`CandidateRecord`)**: Ingestion model containing candidate metadata, resume text, Azure Blob Storage URL (`cv_file_path`), and status (`CREATED`, `PARSED`, `QUEUED`, `IN_PROGRESS`, `ENRICHED`, `ENRICHMENT_FAILED`).
4. **Enriched Profile (`EnrichedProfile`)**: Multi-channel data aggregated from GitHub API (repos, top languages, README), LinkedIn Apify scraper (experiences, educations), and 5-axis Technical Skill Matrix analytics.
5. **Auth User (`AuthUser` / `public.users`)**: System user authenticated via Google OAuth 2.0 with assigned role (`admin`, `hr`, `hr_manager`, `tech_lead`, `recruiter`, `interviewer`).

---

## 3. Candidate & Enrichment Lifecycle State Machine

```
[Resume PDF Upload] ──► CREATED ──► PARSED ──► QUEUED ──► IN_PROGRESS ──► ENRICHED
                                 │                                    │
                                 └────────────────────────────────────┴──► ENRICHMENT_FAILED
```

### State Transition Rules
- `CREATED`: Triggered automatically upon PDF upload via `/api/v1/ingest` or `/api/ingestion/upload`.
- `PARSED`: Triggered when PDF text extraction successfully parses GitHub username or LinkedIn URL.
- `QUEUED`: Enqueued into background worker queue for enrichment processing (`/api/enrichment/{uuid}/sync`).
- `IN_PROGRESS`: Set when enrichment worker starts fetching GitHub and LinkedIn data.
- `ENRICHED`: Final enriched state when GitHub repos, LinkedIn experiences, and skill radar matrix are compiled and streamed via WebSocket (`/api/enrichment/ws/v1/analysis/{uuid}`).
- `ENRICHMENT_FAILED`: Error state triggered when scraping or database upsert fails.

---

## 4. Role-Based Workflows & Operational Actors

| Role | Primary Responsibilities | Key UI / API Boundaries |
|------|--------------------------|------------------------|
| **Recruiter / HR / HR Manager** | Upload resumes, post jobs, review applications, trigger AI enrichment, schedule interviews | Full pipeline access, `/api/v1/ingest`, `/api/enrichment/{uuid}/sync` |
| **Tech Lead / Hiring Manager** | Review AI skill matrix, evaluate GitHub repos & READMEs, technical interviews | Candidate Profile, Radar Charts (`EnrichedRadar`), Skill Matrix |
| **Technical Interviewer** | Conduct technical evaluation, submit interview feedback | Assigned Candidate view, ABAC PII-masked view, Evaluation form |
| **System Admin** | System administration, role management, user provisioning, system auditing | Full access across all API endpoints & Supabase tables |

---

## 5. Endpoints & Communication Workflow

1. **Authentication**: `POST /api/auth/google`, `POST /api/auth/refresh`
2. **Resume Ingestion**: `POST /api/v1/ingest` (Azure Blob upload + Service Bus event) or `POST /api/ingestion/upload`
3. **Enrichment Sync**: `POST /api/enrichment/{candidate_uuid}/sync`
4. **Enrichment Status**: `GET /api/enrichment/{candidate_uuid}`
5. **Real-time Live Analysis**: `WS /api/enrichment/ws/v1/analysis/{candidate_uuid}`

---

## 6. AI Agent Guidelines for Domain Logic

### When Should AI Load This Skill?
Load this skill when modifying candidate status transitions, designing job application APIs, implementing interview scheduling, or handling role-based business rules.

### Which Modules Depend On This?
- `modules/ingestion`: Sets initial `CREATED` / `PARSED` candidate status.
- `modules/enrichment`: Advances status (`QUEUED` -> `IN_PROGRESS` -> `ENRICHED`) and updates skill affinity.
- `modules/auth`: Enforces role-based permissions (`recruiter`, `admin`, `hr`, `hr_manager`, `tech_lead`, `interviewer`).

### What Files Should AI Modify vs Never Modify?
- **Allowed**: Domain services in `src/backend/modules/*/application/`, models in `domain/models.py`.
- **Never Modify**: Fixed state enum definitions without team approval (`EnrichmentStatus`).

### Common Implementation Mistakes & Anti-Patterns
- **Bypassing State Transitions**: Forcing status updates without passing through the enrichment pipeline.
- **Hardcoding Roles**: Checking strings like `user.role == 'manager'` instead of using standard roles (`recruiter`, `admin`, `hr`, `hr_manager`, `tech_lead`, `interviewer`).
- **Ignoring Audit Trail**: Mutating candidate state without logging structlog audit events.

