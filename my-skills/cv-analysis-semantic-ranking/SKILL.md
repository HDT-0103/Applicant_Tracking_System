---
name: cv-analysis-semantic-ranking
description: End-to-end CV parsing, Gemini 2.0 Flash AI extraction, multi-source enrichment (LinkedIn + GitHub), technical skill radar matrix generation, and candidate scoring for SmartATS
version: 2.0.0
author: SmartATS AI & Talent Engineering Team
tech_stack:
  - FastAPI
  - Python 3.11+
  - Google Gemini 2.0 Flash
  - LangChain
  - Supabase (PostgreSQL + pgvector)
  - Next.js 15
  - Recharts
when_to_use:
  - "automate CV resume parsing and entity extraction"
  - "implement Gemini AI analysis of candidates"
  - "compute 5-axis technical skill radar chart matrices"
  - "trigger GitHub + LinkedIn multi-source candidate enrichment"
  - "render AI candidate analytics split-screen workspace"
---

# CV Analysis, Semantic Ranking & Profile Enrichment Pipeline

## 1. Overview & Architecture

This skill powers the core AI talent intelligence pipeline in SmartATS: ingesting candidate PDF resumes, extracting structured entities using Google Gemini 2.0 Flash, enriching profiles via GitHub APIs and LinkedIn scrapers, generating 5-axis skill radar matrices, and serving real-time analysis to the Next.js workspace UI via WebSockets.

```
src/backend/modules/enrichment/
├── adapters/
│   └── routes.py                  # GET /api/enrichment/{uuid}, WS /api/enrichment/ws/v1/analysis/{uuid}
├── application/
│   ├── enrichment_service.py      # Master Orchestrator: GitHub + LinkedIn + Gemini
│   ├── gemini_parser_service.py   # Gemini AI resume parsing
│   ├── github_ingestion_service.py # GitHub repos, languages, README parsing
│   ├── linkedin_ingestion_service.py # LinkedIn profile scraping
│   └── supabase_candidate_service.py # Persistence adapter
└── domain/
    └── models.py                  # EnrichedProfile, TechnicalSkillMatrix Pydantic models
```

---

## 2. End-to-End Processing Workflow

```
[Uploaded PDF] ──► Ingestion Module (Azure Blob)
                         │
                         ▼
             POST /api/enrichment/{uuid}/sync
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
1. Gemini 2.0 Flash            2. Social Link Harvester
   - Full Name, Email, Phone      - GitHub REST API (repos, languages, README)
   - Skills & Work History        - LinkedIn Apify Scraper (headline, experience)
        │                                 │
        └────────────────┬────────────────┘
                         ▼
             3. Skill Matrix Engine
                - Scores 5 axes (Frontend, Backend, Cloud, Security, AI)
                - Computes candidate affinity score (28-100)
                         │
                         ▼
             4. WebSocket Real-time Push
                - Client receives ENRICHED status + JSON payload
```

---

## 3. Skill Matrix Computation Formula

The skill matrix measures competency across 5 technical axes:
1. `frontend_development` (React, Next.js, TypeScript, Tailwind)
2. `backend_development` (Python, Go, Java, FastAPI, PostgreSQL)
3. `devops_cloud` (Docker, Kubernetes, AWS, Azure, Terraform)
4. `infosec` (OAuth, JWT, Encryption, ABAC, Security)
5. `data_ai` (PyTorch, TensorFlow, Gemini, LangChain, Pandas)

### Scoring Formula
$$\text{Score} = 25 + (\text{KeywordHits} \times 12) + (\text{LanguageBiasPct} \times 0.35)$$

- **Affinity Score**: Weighted average of top 3 skill dimensions, normalized between 28 and 100.

---

## 4. WebSocket & API Specifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/enrichment/{uuid}/sync` | `recruiter`, `hr_manager`, `tech_lead`, `admin` | Trigger multi-source enrichment pipeline |
| `GET` | `/api/enrichment/{uuid}` | `recruiter`, `hr_manager`, `tech_lead`, `admin` | Retrieve current enrichment status |
| `WS` | `/api/enrichment/ws/v1/analysis/{uuid}` | Public / Session | Stream real-time enrichment updates |

---

## 5. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when modifying CV parsing logic, tuning Gemini extraction prompts, editing GitHub/LinkedIn enrichment code, updating skill radar formulas, or building candidate analytics UI.

### What Problems Does This Skill Solve?
Automates manual resume screening, eliminates data entry overhead, enriches candidates with real technical evidence, and visualizes applicant skill fit.

### Dependent Modules & Required Skills:
- `ingestion-azure-pipeline` (Provides PDF source binary)
- `ats-business-domain` (Provides hiring stage transition targets)
- `ai-governance-eval` (Provides LLM prompt versioning & fallback rules)
- `shared-infrastructure` (Provides configuration & Supabase client)

### Which Files Should AI Modify vs Never Modify?
- **Modify**: `modules/enrichment/application/*`, `modules/enrichment/domain/models.py`, `src/frontend/components/AiAnalyticsWorkspace.tsx`.
- **Never Modify**: `modules/enrichment/domain/models.py` structural schema without updating frontend TypeScript interfaces.

### Common Anti-Patterns & Implementation Mistakes:
- **Blocking HTTP Calls in Async Routes**: Always run long scraping tasks in background tasks or async routines.
- **Ignoring Duplicate Sync Calls**: Always check if candidate is already in `QUEUED` or `IN_PROGRESS` status before starting new sync.
- **Lack of Fallback Data**: Failing to load `FallbackDataWizard.tsx` when external APIs fail.
