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
  - Renidly API (LinkedIn Backup)
  - WebSocket Push Protocol
  - Supabase
when_to_use:
  - "fetch public GitHub repositories, language statistics, or README files"
  - "scrape candidate LinkedIn profiles via Apify Actor or Renidly API"
  - "orchestrate multi-channel enrichment workers"
  - "handle real-time WebSocket event pushes for candidate analysis"
---

# Enrichment Module: Multi-Source Candidate Data Harvesting

## 1. Overview & Data Sourcing Architecture

The Multi-Source Enrichment module aggregates candidate footprints from external public channels to verify experience claims made on resumes.

```
                  ┌─────────────────────────────────────────┐
                  │   POST /api/enrichment/{uuid}/sync      │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                             [enrichment_worker]
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
[fetch_github_profile]       [fetch_linkedin_profile]      [Supabase Persistence]
 - GET /users/{user}/repos     - Apify Actor `GOvL4O4...`    - UPSERT github_profiles
 - Language % calculation      - Backup: Renidly API         - UPSERT linkedin_profiles
 - README semantic scan        - Headline & Experiences      - UPSERT candidates table
         │                             │                             │
         └─────────────────────────────┼─────────────────────────────┘
                                       ▼
                        [generate_analytics Engine]
                                       │
                                       ▼
                    [WebSocket Real-Time Broadcast]
```

---

## 2. External Integration Protocols

### 1. GitHub Integration (`fetch_github_profile`)
- **Endpoint**: `https://api.github.com/users/{username}/repos`
- **Extracted Fields**: Repository name, language, size, top language percentage calculations, README content.
- **README Scanner**: Pulls `README.md` from the top 5 most recently updated repositories (up to 3000 chars per repo).
- **Authentication**: Uses `GITHUB_API_TOKEN` header. Fallback to public unauthenticated rate-limited requests if omitted.

### 2. LinkedIn Integration (`fetch_linkedin_profile` & `linkedin_scraper.py`)
- **Primary Scraper Engine**: `ApifyClientAsync(token=settings.apify_api_token)` calling Actor ID `GOvL4O4RwFqsdIqXF`.
- **Secondary Scraper Engine**: Renidly API (`https://renidly.com/api/data/v1/people/profile`) using `X-renidly-apikey`.
- **Extracted Fields**: Full name, headline, avatar URL, work experiences (title, company, dates, description), educations, certifications.
- **URL Normalization**: Normalizes domain `://linkedin.com` to `://www.linkedin.com`, ensures trailing slash `/`, and preserves handle casing.

---

## 3. WebSocket Event Schema

Client connects to `ws://{host}/api/enrichment/ws/v1/analysis/{candidate_uuid}`:

```json
{
  "status": "ENRICHED",
  "data": {
    "github_username": "octocat",
    "linkedin_url": "https://www.linkedin.com/in/octocat/",
    "full_name": "Octo Cat",
    "github": {
      "public_repos_count": 14,
      "top_languages": { "Python": 65.5, "TypeScript": 24.5, "Go": 10.0 }
    },
    "linkedin": {
      "full_name": "Octo Cat",
      "headline": "Lead Developer",
      "experiences": [
        { "title": "Staff Engineer", "company": "GitHub Corp", "start_date": "Jan 2022", "end_date": "Present" }
      ]
    },
    "analytics": {
      "match_confidence_score": 89.5,
      "score_increase": 4.2,
      "semantic_tags": ["#python", "#fastapi", "#react"],
      "technical_skill_matrix": {
        "pre_enrichment": [55.0, 52.0, 48.0, 45.0, 50.0],
        "post_enrichment": [73.3, 69.3, 64.0, 60.0, 66.7]
      }
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
- **Unbounded Scraping**: Calling Apify without validating candidate LinkedIn URL format.
- **Exhausting GitHub Rate Limits**: Forgetting to pass `GITHUB_API_TOKEN` header.
- **Blocking Socket Loop**: Calling blocking synchronous network routines inside Starlette WebSocket event loops.
