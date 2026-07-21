---
name: enrichment-multi-source
description: Multi-source candidate enrichment pipeline — LinkedIn (Apify), GitHub API, Gemini AI parsing, and skill matrix computation
version: 1.0.0
tech_stack:
  - FastAPI
  - Python 3.11+
  - Google Gemini 2.0 Flash
  - ApifyClient (LinkedIn scraping)
  - GitHub REST API
  - WebSocket (real-time push)
when_to_use:
  - "enrich candidate profiles with GitHub data"
  - "scrape LinkedIn profiles via Apify"
  - "parse PDF resumes with Gemini AI"
  - "compute technical skill radar chart scores"
  - "implement WebSocket push for enrichment status"
  - "generate mock analytics for candidates without social links"
---

# Enrichment Module: Multi-Source Candidate Enrichment

## Overview

After a candidate's CV is ingested, the enrichment module asynchronously fetches data from multiple external sources to build a comprehensive candidate profile. Results are pushed to the frontend in real-time via WebSocket.

## Data Sources

| Source | Service | API | Data Extracted |
|--------|---------|-----|----------------|
| Gemini AI | `gemini_parser_service.py` | Google Gemini 2.0 Flash via HTTP | full_name, email, phone, skills[], experience[], education[], projects[], languages[] |
| GitHub | `github_ingestion_service.py` | GitHub REST API | Public repos, languages with %, README content |
| LinkedIn | `linkedin_ingestion_service.py` | Apify Actor `GOvL4O4RwFqsdIqXF` | Headline, experience, education, certifications, avatar |
| Local Fallback | `enrichment_service.py` | Keyword matching + language bias | Skill radar scores, semantic tags |

## Flow

```
POST /api/enrichment/{uuid}/sync
       │
       ▼
EnrichmentService
  ├── Status → QUEUED
  ├── Status → IN_PROGRESS
  │
  ├── 1. Get social links from Supabase
  ├── 2. If github_username → fetch_github_profile()
  │     ├── GET /users/{username}/repos → repos, languages
  │     └── GET /repos/{username}/{repo}/readme → README content
  ├── 3. If linkedin_url → fetch_linkedin_profile()
  │     └── Apify Actor call → experience, education, certifications
  ├── 4. Gemini parser → structured profile from PDF
  ├── 5. Compute skill matrix → 5 category scores + affinity
  │
  ├── Status → ENRICHED (or FAILED)
  └── Push to WebSocket /api/enrichment/ws/v1/analysis/{uuid}
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/enrichment/{uuid}/sync` | recruiter, admin | Trigger full enrichment pipeline |
| GET | `/api/enrichment/{uuid}` | recruiter, admin | Get enrichment status |
| WS | `/api/enrichment/ws/v1/analysis/{uuid}` | — | Real-time enrichment results |

### WebSocket Protocol

**Server → Client message (ENRICHED):**
```json
{
  "status": "ENRICHED",
  "data": {
    "candidate_uuid": "...",
    "full_name": "Maya Lindqvist",
    "headline": "Senior ML Engineer",
    "github_profile": { ... },
    "linkedin_profile": { ... },
    "technical_skill_matrix": {
      "frontend_development": 28,
      "backend_development": 72,
      "devops_cloud": 65,
      "infosec": 45,
      "data_ai": 91
    },
    "affinity_score": 85,
    "semantic_tags": ["#python", "#machine-learning", "#pytorch", ...],
    "experiences": [ ... ],
    "educations": [ ... ]
  }
}
```

## Skill Matrix Computation

Scoring in `enrichment_service.py::analyze_github_local_fallback()`:

| Category | Keywords | Language Bias |
|----------|----------|---------------|
| Frontend | react, nextjs, typescript, javascript, tailwind, css, html | JavaScript, TypeScript, HTML, CSS |
| Backend | python, golang, java, nodejs, express, fastapi, postgresql, mongodb, redis | Python, Go, Java, C#, Rust |
| Cloud Dev | docker, kubernetes, k8s, aws, azure, cicd, terraform, nginx | Dockerfile, HCL, YAML |
| InfoSec | security, oauth, jwt, encryption, ssl, tls, authentication, authorization, pentest | — |
| ML / AI | pytorch, tensorflow, pandas, numpy, machine learning, ai, spark | Jupyter Notebook, Python, R |

**Formula**: `score = 25 + (keyword_hits × 12) + (language_bias_pct × 0.35)`

**Affinity Score**: Average of top 3 skill scores, scaled to 28-100 range.

## Key Files

| File | Responsibility |
|------|----------------|
| `enrichment_service.py` | Orchestrator: calls all services, manages status, pushes WS |
| `gemini_parser_service.py` | Parses PDF bytes via Gemini API into structured JSON |
| `github_ingestion_service.py` | Fetches repos, languages, README from GitHub |
| `linkedin_ingestion_service.py` | LinkedIn scraping via Apify Actor |
| `linkedin_scraper_service.py` | Alternative LinkedIn scraper (Renidly API) |
| `supabase_candidate_service.py` | Reads/writes candidate profiles to Supabase |
| `domain/models.py` | All enrichment Pydantic models |

## Environment Variables

```bash
# Required for Gemini parsing
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash

# Required for GitHub
GITHUB_API_TOKEN=...

# Required for LinkedIn (Apify)
APIFY_API_TOKEN=...

# Required for persistence
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

## Duplicate Sync Prevention

The service checks `candidate_enrichments[candidate_uuid].enrichment_status`:
- If `QUEUED` or `IN_PROGRESS` → return immediately without re-queuing
- If `ENRICHED` or `FAILED` or absent → allow new sync

## WebSocket Lifecycle

```python
# Server: register + push
active_websockets[candidate_uuid] = [websocket]
await websocket.send_json({"status": "ENRICHED", "data": profile.model_dump()})

# Client: listen
const ws = new WebSocket(`ws://host/api/enrichment/ws/v1/analysis/${uuid}`);
ws.onmessage = (event) => {
  const { status, data } = JSON.parse(event.data);
  if (status === 'ENRICHED') displayProfile(data);
};
```
