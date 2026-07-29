---
name: cv-analysis-semantic-ranking
description: End-to-end CV parsing, Gemini AI-powered analysis, and candidate enrichment/ranking for SmartATS using FastAPI, Gemini, LangChain, and Supabase
version: 2.0.0
author: SmartATS Engineering
tech_stack:
  - FastAPI
  - Python 3.11+
  - LangChain
  - Google Gemini 2.0 Flash
  - Supabase (PostgreSQL)
  - OpenAI (optional embeddings)
  - Next.js 15
  - TypeScript
when_to_use:
  - "automate CV/resume parsing pipeline"
  - "implement AI-powered candidate analysis with Gemini"
  - "trigger LinkedIn + GitHub enrichment"
  - "configure resume upload and validation"
  - "display AI-generated candidate radar charts"
  - "automated candidate enrichment workflows"
---

# CV Analysis and Semantic Ranking Automation Skill

## Overview

This skill covers the core AI-powered recruitment workflow in SmartATS: ingesting PDF resumes, extracting structured candidate data via Google Gemini 2.0 Flash, enriching profiles from LinkedIn (Apify) and GitHub APIs, generating AI analysis with skill radar charts, and serving the workspace UI.

## Architecture Context

SmartATS follows a **Modular Monolith + Clean Architecture** pattern:

```
src/backend/
├── apps/
│   ├── main.py                   # FastAPI entry point
│   └── __init__.py
├── middleware/
│   └── validateResume.ts          # Express-style PDF validation (magic bytes)
└── modules/
    ├── ingestion/                 # CV upload, Azure Blob, Service Bus
    ├── enrichment/                # LinkedIn/GitHub/Gemini AI analysis
    ├── auth/                      # Google OAuth + JWT + Supabase roles
    └── shared/                    # Config, Supabase client, auth deps
```

**Frontend**: Next.js 15 + React 19, TypeScript, pure CSS globals, lucide-react icons

## Module Structure

```
modules/enrichment/
├── adapters/
│   ├── __init__.py
│   └── routes.py                  # REST + WebSocket endpoints
├── application/
│   ├── __init__.py
│   ├── enrichment_service.py      # Orchestrator: GitHub + LinkedIn + Gemini
│   ├── gemini_parser_service.py   # Gemini AI resume parsing
│   ├── github_ingestion_service.py
│   ├── linkedin_ingestion_service.py
│   ├── linkedin_scraper_service.py
│   └── supabase_candidate_service.py
├── domain/
│   ├── __init__.py
│   └── models.py                  # Pydantic models for all enrichment entities
└── __init__.py
```

## Key Workflows

### 1. CV Ingestion (Upload + Validate)

**Trigger**: Candidate or recruiter uploads PDF CV via frontend

**Flow**:
1. Frontend sends PDF to `POST /api/v1/ingest` (multipart form)
2. Backend `validateResume.ts` middleware checks:
   - File size < 10MB (multer limit)
   - MIME type = `application/pdf`
   - Magic bytes (`%PDF` header)
3. `IngestionService` stores to Azure Blob Storage + queues to Azure Service Bus
4. Candidate record created in Supabase with UUID

**Key Files**:
- `src/backend/middleware/validateResume.ts`
- `src/backend/modules/ingestion/adapters/routes.py`
- `src/backend/modules/ingestion/application/ingestion_service.py`
- `src/backend/modules/ingestion/infra/azure_blob_service.py`
- `src/backend/modules/ingestion/infra/azure_service_bus_service.py`
- `src/backend/modules/ingestion/domain/models.py`

### 2. AI-Powered CV Parsing (Gemini)

**Trigger**: After ingestion, enrichment sync is called

**Flow**:
1. `EnrichmentService` fetches candidate profile from Supabase
2. Downloads PDF from Azure Blob via SAS URL
3. Sends PDF bytes to Gemini 2.0 Flash API via `http.Client`
4. Gemini extracts: full_name, email, phone, skills[], experience[], education[], projects[], languages[], certifications[]
5. Structured profile saved to `candidate_profiles` Supabase table
6. Technical skill matrix computed from 5 categories: Frontend, Backend, Cloud Dev, InfoSec, ML/AI

**Key Files**:
- `src/backend/modules/enrichment/application/gemini_parser_service.py`
- `src/backend/modules/enrichment/application/enrichment_service.py`
- `src/backend/modules/enrichment/domain/models.py` — `EnrichedProfile`, `TechnicalSkillMatrix`

### 3. External Profile Enrichment (LinkedIn + GitHub)

**Trigger**: Manual sync via `/api/enrichment/{uuid}/sync`

**Flow**:
1. Read candidate social links from `candidate_profiles` table
2. **GitHub**: Fetch public repos, languages, README content via GitHub API
3. **LinkedIn**: Use Apify Actor `GOvL4O4RwFqsdIqXF` to scrape profile (headline, experience, education, certifications)
4. Merge all data into `EnrichedProfile` domain model
5. Push results to WebSocket at `/api/enrichment/ws/v1/analysis/{uuid}`

**Key Files**:
- `src/backend/modules/enrichment/application/enrichment_service.py`
- `src/backend/modules/enrichment/application/github_ingestion_service.py`
- `src/backend/modules/enrichment/application/linkedin_ingestion_service.py`
- `src/backend/modules/enrichment/application/linkedin_scraper_service.py`

### 4. Skill Radar & Analytics Generation

**Flow**:
1. Candidate skills vs keyword groups → 5 dimensions scored 0-100:
   - `frontend_development`, `backend_development`, `devops_cloud`, `infosec`, `data_ai`
2. Language bias bonus from GitHub top languages
3. README keyword scanning for additional semantic tags
4. Candidate affinity score computed (28-100 scale)
5. Career timeline constructed from experience entries
6. Frontend renders `AiAnalyticsWorkspace.tsx` with recharts radar chart

**Key Files**:
- `src/backend/modules/enrichment/application/enrichment_service.py` — `analyze_github_local_fallback()`
- `src/frontend/components/AiAnalyticsWorkspace.tsx`
- `src/frontend/components/ProfileHeader.tsx`

## API Endpoints

### Ingestion (public, no auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ingest` | Upload CV PDF (multipart) → Azure Blob + Service Bus |
| POST | `/api/v1/ingest/azure` | Azure-triggered ingestion alternative |

### Enrichment (auth required: recruiter, admin)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/enrichment/{uuid}/sync` | Trigger LinkedIn + GitHub + Gemini sync |
| GET | `/api/enrichment/{uuid}` | Get enrichment status |
| WS | `/api/enrichment/ws/v1/analysis/{uuid}` | Real-time analysis push via WebSocket |

## Enrichment Status Lifecycle

```
QUEUED → IN_PROGRESS → ENRICHED
                   ↘ FAILED
```

Status stored in-memory `candidate_enrichments: Dict[str, CandidateEnrichment]` with WebSocket push on completion.

## Domain Models

All defined in `modules/enrichment/domain/models.py`:

- `CandidateEnrichment` — Status tracking + enriched profile container
- `CandidateSocialLinks` — `github_username`, `linkedin_url`
- `EnrichedProfile` — Full candidate profile (GitHub + LinkedIn + parsed data + skill matrix)
- `GitHubProfile`, `GitHubRepo` — GitHub stats and repos
- `LinkedInProfile`, `LinkedInExperience`, `LinkedInEducation`, `LinkedInCertification`
- `TechnicalSkillMatrix` — 5 skill scores with computed affinity
- `MockAnalytics` — Fallback analytics when no social links
- `EnrichmentStatus` — Enum: QUEUED, IN_PROGRESS, ENRICHED, FAILED

## Environment Configuration

```bash
# Application
APP_NAME=SmartATS
APP_ENV=development
JWT_SECRET=change_me
ADMIN_EMAILS=admin@example.com
RECRUITER_EMAIL_DOMAINS=example.com

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# LLM / AI
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
OPENAI_API_KEY=...          # Optional for embeddings
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# External APIs
GITHUB_API_TOKEN=...
APIFY_API_TOKEN=...         # For LinkedIn scraping

# Azure Storage (CV binary upload)
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_SERVICE_BUS_CONNECTION_STRING=...

# Supabase (candidate profiles + auth)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

## Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| AiAnalyticsWorkspace | `components/AiAnalyticsWorkspace.tsx` | Split-screen: PDF + AI analysis with radar chart |
| ProfileHeader | `components/ProfileHeader.tsx` | Candidate name, title, affinity score, meta tags |
| PdfToolbar | `components/PdfToolbar.tsx` | PDF navigation, zoom, download |
| FallbackDataWizard | `components/FallbackDataWizard.tsx` | Manual data entry when parsing fails |
| IdleUploadZone | `components/IdleUploadZone.tsx` | Drag-and-drop PDF upload zone |
| LeftSidebar | `components/LeftSidebar.tsx` | Navigation sidebar |

## Canvas/Context Architecture

- `WorkspaceContext` (`contexts/WorkspaceContext.tsx`) — Central state for selected candidate, enrichment data, sync trigger
- `AuthContext` (`contexts/AuthContext.tsx`) — Auth state, login/logout, token management
- `AuthGuard` — Route protection by role

## Best Practices

### CV Ingestion
1. Validate PDF magic bytes (`%PDF` header) server-side
2. Use Azure Blob SAS URLs for secure resume downloads
3. Queue enrichment via background tasks (FastAPI `BackgroundTasks`)
4. Never store raw PDF text in memory longer than needed

### Gemini Parsing
1. Use structured prompts to get consistent JSON output
2. Retry with exponential backoff on 429/5xx responses
3. Validate parsed JSON against Pydantic models before persisting
4. Fallback to `FallbackDataWizard` UI if parsing confidence low
5. Cache Gemini responses by PDF content hash

### Enrichment
1. Always check if enrichment already running (QUEUED/IN_PROGRESS) before re-queueing
2. Use WebSocket for real-time push instead of polling
3. Clean up stale enrichments from in-memory store periodically
4. Normalize LinkedIn URLs before sending to Apify (`www.linkedin.com`)
5. Respect GitHub API rate limits (use token with `GITHUB_API_TOKEN`)

### Skill Analysis
1. Skill keyword scoring is a **local fallback** — always prefer Gemini analysis when available
2. Language bias from GitHub repos gives +35% weight to matching skill groups
3. Affinity score range 28-100 reflects confidence in data completeness
4. Semantic tags generated from both README + top languages

## Troubleshooting

### Gemini Parsing Fails
- **Check**: `GOOGLE_API_KEY` is valid and `GEMINI_MODEL` is accessible
- **Check**: PDF is text-based (not scanned image); Gemini cannot OCR
- **Fix**: Reduce PDF size or chunk content; use `FallbackDataWizard` UI

### LinkedIn Enrichment Fails
- **Check**: `APIFY_API_TOKEN` is active and has credits
- **Check**: LinkedIn URL is valid public profile (not private)
- **Check**: Apify Actor `GOvL4O4RwFqsdIqXF` is accessible
- **Fix**: Remove URL trailing slash normalization issues

### WebSocket Not Receiving Data
- **Check**: `NEXT_PUBLIC_WS_URL` matches backend WebSocket endpoint
- **Check**: Enrichment status transitions to ENRICHED (not stuck in QUEUED)
- **Fix**: Restart enrichment via `/api/enrichment/{uuid}/sync`

### GitHub API Rate Limited
- **Check**: `GITHUB_API_TOKEN` is set in .env
- **Check**: Token has `public_repo` scope
- **Fix**: Reduce `per_page` param or add token rotation

## Integration Points

### Frontend > Backend
```typescript
// Upload CV (careers page)
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('full_name', name);
formData.append('email', email);
await fetch('/api/v1/ingest', { method: 'POST', body: formData });

// Trigger enrichment
await api.post(`/api/enrichment/${candidateUuid}/sync`);

// WebSocket listener
const ws = new WebSocket(`ws://localhost:8000/api/enrichment/ws/v1/analysis/${uuid}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.status === 'ENRICHED') setEnrichedProfile(data.data);
};
```

### Enrichment Worker Flow (simplified)
```python
async def enrichment_worker(candidate_uuid: str, settings: Settings):
    candidate_enrichments[candidate_uuid].enrichment_status = IN_PROGRESS

    # 1. Gemini parse PDF from Azure Blob
    enriched = await gemini_parser.parse(candidate_uuid, settings)

    # 2. GitHub enrichment (if username exists)
    social = get_candidate_social_links(candidate_uuid)
    if social.github_username:
        github = await fetch_github_profile(social.github_username, settings)
        enriched.github_profile = github

    # 3. LinkedIn enrichment (if URL exists)
    if social.linkedin_url:
        linkedin = await fetch_linkedin_profile(social.linkedin_url, candidate_uuid, settings)
        enriched.linkedin_profile = linkedin

    # 4. Compute skill matrix
    enriched.technical_skill_matrix = compute_skill_matrix(enriched)

    # 5. Persist + push via WebSocket
    candidate_enrichments[candidate_uuid].enriched_profile = enriched
    candidate_enrichments[candidate_uuid].enrichment_status = ENRICHED
    await push_via_websocket(candidate_uuid, enriched)
```
