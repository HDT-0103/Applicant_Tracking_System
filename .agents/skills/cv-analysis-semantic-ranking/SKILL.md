---
name: cv-analysis-semantic-ranking
description: End-to-end CV parsing, Gemini 2.0 Flash AI extraction, multi-source enrichment (LinkedIn + GitHub), technical skill radar matrix generation, and candidate scoring for SmartATS
version: 2.0.0
author: SmartATS AI & Talent Engineering Team
tech_stack:
  - FastAPI
  - Python 3.11+
  - Google Gemini 2.0 Flash
  - Supabase (PostgreSQL)
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
│   ├── gemini_parser_service.py   # Gemini AI profile parsing
│   ├── github_ingestion_service.py # GitHub repos, languages, README parsing
│   ├── linkedin_ingestion_service.py # LinkedIn profile ingestion into Supabase
│   ├── linkedin_scraper_service.py# Playwright / BeautifulSoup scraper
│   └── supabase_candidate_service.py # Persistence adapter
└── domain/
    └── models.py                  # EnrichedProfile, TechnicalSkillMatrix Pydantic models
```

---

## 2. End-to-End Processing Workflow

```
[Uploaded PDF] ──► Ingestion Module (Azure Blob / Local)
                         │
                         ▼
             POST /api/enrichment/{uuid}/sync
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
1. PDF Link Harvester           2. Multi-Source Scraper
   - GitHub username              - GitHub REST API (repos, top_languages, README)
   - LinkedIn profile URL         - LinkedIn Apify Scraper (headline, experience, edu)
        │                                 │
        └────────────────┬────────────────┘
                         ▼
             3. Technical Skill Matrix Engine (`generate_analytics`)
                - Computes 5 axes: Backend, Frontend, Cloud Dev, InfoSec, ML / AI
                - Computes Match Confidence score & Score Increase
                         │
                         ▼
             4. WebSocket Real-time Broadcast (`/api/enrichment/ws/v1/analysis/{uuid}`)
                - Client receives ENRICHED status + EnrichedProfile payload
```

---

## 3. Skill Matrix Computation Formula

The skill matrix measures competency across 5 technical axes:
1. `Backend` (`backend_development`: Python, Go, Java, FastAPI, PostgreSQL, Node)
2. `Frontend` (`frontend_development`: React, Next.js, TypeScript, Tailwind, CSS)
3. `Cloud Dev` (`devops_cloud`: Docker, Kubernetes, AWS, Azure, Terraform)
4. `InfoSec` (`infosec`: OAuth, JWT, Encryption, Authentication, Authorization)
5. `ML / AI` (`data_ai`: PyTorch, TensorFlow, Pandas, NumPy, AI)

### Scoring Formula (`analyze_github_local_fallback`)
$$\text{Score} = 25.0 + (\text{KeywordHits} \times 12.0) + \text{LanguageBonus}$$

- `LanguageBonus`: Sum of top language percentage $\times 0.35$ for matching language biases.
- Scores bounded between $0.0$ and $100.0$.
- `pre_enrichment` baseline scores calculated as `round(post_enrichment * 0.75, 1)`.

---

## 4. WebSocket & API Specifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/enrichment/{candidate_uuid}/sync` | `recruiter`, `admin`, `hr`, `hr_manager`, `tech_lead` | Trigger multi-source enrichment worker |
| `GET` | `/api/enrichment/{candidate_uuid}` | `recruiter`, `admin`, `hr`, `hr_manager`, `tech_lead` | Retrieve current enrichment status |
| `WS` | `/api/enrichment/ws/v1/analysis/{candidate_uuid}` | Public / Session | Stream real-time enrichment updates |

---

## 5. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when modifying CV parsing logic, tuning Gemini extraction prompts, editing GitHub/LinkedIn enrichment code, updating skill radar formulas, or building candidate analytics UI.

### What Problems Does This Skill Solve?
Automates manual resume screening, eliminates data entry overhead, enriches candidates with real technical evidence, and visualizes applicant skill fit.

### Dependent Modules & Required Skills:
- `ingestion-azure-pipeline` (Provides PDF source binary & Blob URL)
- `ats-business-domain` (Provides hiring stage transition targets)
- `ai-governance-eval` (Provides LLM prompt versioning & fallback rules)
- `shared-infrastructure` (Provides configuration & Supabase client)

### Which Files Should AI Modify vs Never Modify?
- **Modify**: `modules/enrichment/application/*`, `modules/enrichment/domain/models.py`, `src/frontend/app/candidate-profile/enriched/page.tsx`.
- **Never Modify**: `modules/enrichment/domain/models.py` structural schema without updating frontend TypeScript interfaces in `enriched/page.tsx`.

### Common Anti-Patterns & Implementation Mistakes:
- **Blocking Network Calls in Sockets**: Always run asynchronous scraper tasks using `httpx.AsyncClient` or `ApifyClientAsync`.
- **Ignoring Existing Enrichment**: Always check if candidate is already `ENRICHED` or stored in Supabase before queueing duplicate background jobs.
- **Lack of Fallback Data**: Failing to load `analyze_github_local_fallback` when external APIs or Gemini key are unavailable.

