---
name: enrichment-multi-source
description: Multi-source candidate data harvesting pipeline — GitHub REST API, LinkedIn Apify scraping, Gemini parsing, and real-time WebSocket orchestration
version: 2.0.0
author: SmartATS Sourcing & Data Engineering Team
tech_stack:
  - FastAPI
  - Python 3.11+
  - GitHub REST API
  - Apify Client (LinkedIn Scraper)
  - WebSocket Push Protocol
  - Supabase
when_to_use:
  - "fetch public GitHub repositories, language statistics, or README files"
  - "scrape candidate LinkedIn profiles via Apify Actor"
  - "orchestrate multi-channel enrichment workers"
  - "handle real-time WebSocket event pushes for candidate analysis"
---

# Enrichment Module: Multi-Source Candidate Data Harvesting

## 1. Overview & Data Sourcing Architecture

The Multi-Source Enrichment module aggregates candidate footprints from external public channels to verify experience claims made on resumes.

```
                  ┌─────────────────────────────────────────┐
                  │       POST /api/enrichment/{uuid}/sync  │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                             [Enrichment Orchestrator]
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
[GitHub Ingestion]            [LinkedIn Scraper]            [Gemini Resume Parser]
 - GET /users/{user}/repos     - Apify Actor `GOvL4O4...`    - PDF text extraction
 - Language % calculation      - Headline & Experience       - Structured skills & edu
 - README semantic scan        - Educations & Certificates
         │                             │                             │
         └─────────────────────────────┼─────────────────────────────┘
                                       ▼
                       [Technical Skill Matrix Engine]
                                       │
                                       ▼
                   [WebSocket Real-Time Push / Broadcast]
```

---

## 2. External Integration Protocols

### 1. GitHub Integration (`github_ingestion_service.py`)
- **Endpoint**: `https://api.github.com/users/{username}/repos`
- **Extracted Fields**: Repository name, language, size, stargazers count, README content.
- **Rate Limit Handling**: Requires `GITHUB_API_TOKEN` header. Fallback to public endpoints if unauthenticated.

### 2. LinkedIn Integration (`linkedin_ingestion_service.py`)
- **Scraper Engine**: Apify Actor `GOvL4O4RwFqsdIqXF` via `ApifyClient`.
- **Extracted Fields**: Profile headline, work experiences (title, company, dates, description), educations, certifications.
- **Normalization**: Automatically strips `https://`, trailing slashes, and parameter strings from profile URLs.

---

## 3. WebSocket Event Schema

Client connects to `ws://{host}/api/enrichment/ws/v1/analysis/{candidate_uuid}`:

```json
{
  "status": "ENRICHED",
  "data": {
    "candidate_uuid": "2f7c4b54-ed1e-4273-8b36-95e6999c8b50",
    "full_name": "Alex Mercer",
    "headline": "Senior Software Architect",
    "github_profile": {
      "public_repos_count": 14,
      "top_languages": { "Python": 65.5, "TypeScript": 24.5, "Go": 10.0 }
    },
    "linkedin_profile": {
      "experiences": [
        { "title": "Staff Engineer", "company": "Tech Corp", "is_current": true }
      ]
    },
    "technical_skill_matrix": {
      "pre_enrichment": [55, 52, 48, 45, 50],
      "post_enrichment": [72, 70, 66, 58, 64]
    }
  }
}
```

---

## 4. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when configuring GitHub/LinkedIn scrapers, tuning Apify integrations, editing enrichment worker tasks, or handling WebSocket server handlers.

### What Problems Does This Skill Solve?
Harvests external evidence to corroborate resume claims, computes objective skill metrics, and pushes live updates to recruiters.

### Dependent Modules & Required Skills:
- `cv-analysis-semantic-ranking` (Master analysis framework)
- `shared-infrastructure` (Provides Supabase & HTTP settings)
- `ai-governance-eval` (Provides fallback strategies when APIs fail)

### Common Anti-Patterns & Implementation Mistakes:
- **Unbounded Scraping**: Calling Apify without checking if LinkedIn URL is valid.
- **Exhausting GitHub Rate Limits**: Forgetting to pass `GITHUB_API_TOKEN`.
- **Blocking Socket Loop**: Calling blocking synchronous network routines inside Starlette WebSocket event loops.
