# SmartATS

An AI-assisted Applicant Tracking System. Recruiters upload a CV; the system
parses it, enriches the candidate from public GitHub and LinkedIn data, scores
the fit against a job posting, and helps schedule the interview.

The project deliberately mixes two styles of engineering: deterministic
services for anything that must be auditable (permissions, persistence,
scheduling maths) and LLM reasoning only where judgement is genuinely needed
(parsing free-form CVs, summarising a profile).

---

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Running the pipeline](#running-the-pipeline)
- [Roles and permissions](#roles-and-permissions)
- [Testing](#testing)
- [Configuration](#configuration)
- [Known limitations](#known-limitations)

---

## Architecture

```
                    ┌──────────────────────────┐
   Recruiter ─────▶ │  Next.js frontend        │
                    │  (App Router, RSC)       │
                    └────────────┬─────────────┘
                                 │  JWT (access + refresh)
                                 ▼
                    ┌──────────────────────────┐
                    │  FastAPI backend         │
                    │  modules/*               │
                    └────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   ┌─────────┐            ┌────────────┐           ┌─────────────┐
   │ Gemini  │            │  Supabase  │           │  GitHub /   │
   │ CV parse│            │  Postgres  │           │  LinkedIn   │
   └─────────┘            │  + pgvector│           └─────────────┘
                          └────────────┘
```

The backend is organised by **module**, not by technical layer. Each module
under `src/backend/modules/` owns its own `domain/`, `application/`,
`adapters/` and `infra/` folders, so a feature can be read top to bottom in one
place.

| Module | Responsibility |
| --- | --- |
| `auth` | Registration, email/password and Google sign-in, JWT issuing and refresh |
| `ingestion` | CV upload, PDF text extraction, Gemini parsing, candidate record creation |
| `enrichment` | GitHub and LinkedIn enrichment, analytics, live progress over WebSocket |
| `scoring` | Embeddings and similarity scoring between candidate and job posting |
| `review` | Human review decisions on a candidate |
| `scheduling` | Interview slot search (sweep-line over interviewer availability), Google Calendar |
| `admin` | User management, session revocation, ABAC policy inspection, audit log |
| `shared` | Configuration, Supabase client, JWT dependencies, ABAC field masking |

`src/backend/app/` is an older SQLAlchemy-era layer kept for the pipelines and
repositories that still reference it. New work belongs in `modules/`.

---

## Tech stack

**Frontend** — Next.js 15 (App Router), React 19, TypeScript (strict),
Tailwind CSS, Recharts, `lucide-react`.

**Backend** — FastAPI, Pydantic v2, `structlog`, Supabase Python SDK.

**Data** — Supabase (PostgreSQL + `pgvector`). Vector search and lexical search
run as Postgres RPC functions rather than in application code.

**AI** — Google Gemini for CV parsing, `sentence-transformers` (E5) for local
embeddings, LangGraph for the agent workflow.

---

## Repository layout

```
.
├── conftest.py                  # pytest bootstrap: loads .env, fixes sys.path
├── src/
│   ├── backend/
│   │   ├── apps/main.py         # the FastAPI entry point
│   │   ├── modules/             # feature modules (see table above)
│   │   ├── app/                 # legacy SQLAlchemy layer + pipelines
│   │   ├── migrations/          # numbered SQL migrations (V002…V007)
│   │   └── scripts/             # seeding and schema-check utilities
│   └── frontend/
│       ├── app/                 # routes (App Router)
│       ├── components/          # shared components
│       ├── contexts/            # Auth and Workspace providers
│       ├── lib/                 # pure logic: design tokens, JWT, formatting
│       └── services/            # HTTP client, API wrappers
├── tests/                       # backend tests (pipelines, repositories, RPC)
│   └── manual/                  # scripts needing real keys — NOT collected by pytest
└── database.types.ts            # types generated from the live Supabase schema
```

---

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 20+
- A Supabase project (URL, anon key, service-role key)
- A Google Gemini API key

### Install

```bash
python3 -m venv venv
./venv/bin/python -m pip install -r requirements.txt
npm install
```

### Configure

```bash
cp .env.example .env
```

Fill in at minimum `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET`. The backend reads settings at
import time, so a missing required variable stops the app from starting rather
than failing later at request time.

A contract test (`tests/test_env_contract.py`) fails if a required setting is
missing from `.env.example`, so the template cannot silently drift.

### Run

```bash
./start_backend.sh     # FastAPI on :8000
npm run dev            # Next.js on :3000
```

---

## Running the pipeline

The operational endpoints accept **`hr` and `tech_lead` only**. An `admin`
account is confined to the Admin Panel by design and will receive `403` here.

**1. Get a token.** Public registration always creates an `hr` account:

```bash
curl -s -X POST http://localhost:8000/api/auth/register -H 'Content-Type: application/json' -d '{"name":"HR Demo","email":"hr.demo@smartats.com","password":"Demo@12345"}'
```

**2. Upload a CV.** PDF only, 10 MB maximum:

```bash
curl -s -X POST http://localhost:8000/api/ingestion/upload -H "Authorization: Bearer <TOKEN>" -F "file=@cv.pdf;type=application/pdf"
```

Returns the candidate `uuid`.

**3. Enrich.** Runs in the background, roughly 5–30 seconds:

```bash
curl -s -X POST http://localhost:8000/api/enrichment/<UUID>/sync -H "Authorization: Bearer <TOKEN>"
```

**4. Poll until `enrichment_status` is `ENRICHED`:**

```bash
curl -s http://localhost:8000/api/enrichment/<UUID> -H "Authorization: Bearer <TOKEN>"
```

Results are persisted to `enrichment_profiles`, so they survive a restart and
appear on the dashboard.

---

## Roles and permissions

The system has exactly **three** roles. `modules/shared/domain/roles.py` is the
single source of truth.

| Role | Access |
| --- | --- |
| `admin` | Admin Panel only. Explicitly excluded from operational screens. |
| `hr` | Full recruiting workflow, sees complete candidate data. |
| `tech_lead` | Same screens as `hr`, but candidate PII is masked. |

The Postgres `role_type` enum still carries `recruiter`, `interviewer` and
`candidate` because PostgreSQL cannot remove values from an enum. Those are
dead at the application layer: `normalise_role()` converts the first two and
rejects the third.

### Field masking (ABAC)

`modules/shared/infrastructure/abac.py` masks fields on the way out of the API.
Two rules:

1. **Default-deny whitelist** — `tech_lead` sees only fields on an explicit
   allowlist, so a new PII column added later is masked automatically rather
   than leaking until somebody notices.
2. **Always redacted** — EEO/diversity fields (race, gender identity,
   disability status, veteran status, age band, …) are masked for **every**
   role including `admin`. Showing these on a screening screen creates bias at
   the point of decision. They remain in the database for aggregate,
   anonymised reporting only.

Policies may additionally be tightened from the `abac_policies` table. That
table can only ever mask **more**; it cannot unmask a field the code withholds,
so database write access is not a route to candidate PII.

---

## Testing

```bash
npm run test:all      # vitest + pytest
npm run typecheck     # tsc --noEmit
npm run build         # production build
```

Backend tests need no setup — the root `conftest.py` loads `.env` and fixes
`sys.path`, so plain `pytest` works from anywhere in the repo.

Integration tests run against the real Supabase project. They tag their fixture
data per run (for example `Python-a3f9e1c2`) or scope queries by
`candidate_ids`, so they neither collide with existing rows nor with each other.

Scripts that need real API keys or human input live in `tests/manual/` and are
**not** named `test_*.py` on purpose: pytest imports a `test_*.py` file with no
test functions and silently reports nothing, which looks like a pass.

---

## Configuration

Notable settings; see `.env.example` for the full list.

| Variable | Default | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required. Bypasses RLS; backend only, never expose to the frontend. |
| `JWT_SECRET` | — | Required. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh rotates the token, so an active user is never signed out. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Pinned deliberately; Google removes older models. |
| `GITHUB_API_TOKEN` | — | Needs `public_repo`. An expired token makes enrichment return empty scores. |
| `MAX_UPLOAD_MB` | `10` | |

---

## Known limitations

- **Two data paths on the frontend.** Some screens call the backend API with a
  JWT; others query Supabase directly with the anon key. They disagree about
  session state, so half the app can keep working after a session dies.
- **`src/backend/app/` is legacy.** SQLAlchemy models coexist with the Supabase
  SDK. `CVProcessingPipeline` in that tree is not wired to any route.
- **Responsive layout is thin.** The app targets desktop; narrow viewports are
  not yet handled.
- **LinkedIn enrichment needs an Apify token** and will fail without one.
