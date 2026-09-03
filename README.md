# SmartATS

[![CI](https://github.com/HDT-0103/Applicant_Tracking_System/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/HDT-0103/Applicant_Tracking_System/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An AI-assisted Applicant Tracking System. A candidate applies through a public
job board; the system parses their CV with an LLM, enriches the profile from
public GitHub data, ranks it semantically against the job posting, routes it to
a review panel, and helps schedule the interview.

**Live: [smartats.tech](https://smartats.tech)** — no install needed.
The public job board at [`/careers`](https://smartats.tech/careers) is open to
everyone; recruiter screens need an account, which you can create yourself at
[`/register`](https://smartats.tech/register).

> Coursework project for **Introduction to Software Engineering (Intro2SE)**,
> VNUHCM — University of Science.

---

## Table of contents

- [What it does](#what-it-does)
- [What makes it interesting](#what-makes-it-interesting)
- [Architecture](#architecture)
- [Roles and permissions](#roles-and-permissions)
- [Run it locally](#run-it-locally)
- [A tour of the API](#a-tour-of-the-api)
- [Testing](#testing)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Known limitations](#known-limitations)
- [License](#license)

---

## What it does

Four flows, matching the SRS:

**A · Apply.** A candidate opens a shared job link, fills in a screening
questionnaire, and uploads a PDF CV. Gemini extracts structured fields — name,
contact, skills, experience, education — and the application is persisted with
the file in Azure Blob Storage. No account required, ever: a candidate arriving
through a link has no session and never will.

**B · Rank.** A recruiter describes the role in plain language ("senior backend
engineer, distributed systems, must know Go"). Required skills run first as a
**hard filter** — missing one is elimination regardless of how good the
semantic score is — then `multilingual-e5-base` embeddings rank whoever
survives, via a pgvector query inside Postgres rather than in application code.

**C · Enrich.** GitHub activity is pulled and summarised into a skills matrix,
with live progress streamed over a WebSocket. Results are persisted, so they
survive a restart instead of being recomputed on every page view.

**D · Review and schedule.** HR invites Tech Leads onto a review panel per job
posting. A candidate advances only when **80% of the panel approves** — the
threshold, the required count, and the rule are computed server-side and sent
to the browser, so the UI never re-derives them. Once approved, a sweep-line
pass over every interviewer's Google Calendar free/busy finds the slots where
*everyone* is genuinely free, and the confirmation writes a calendar event plus
a Slack notification.

---

## What makes it interesting

These are the decisions worth reading the code for.

**Candidate PII is masked by the API, not by the UI.** `tech_lead` accounts see
`***` instead of names, emails and phone numbers. The masking happens in
`modules/shared/infrastructure/abac.py` on the way out of the backend — if the
UI were doing the hiding, the real values would still be sitting in the network
response for anyone who opened devtools. The whitelist is **default-deny**, so
a PII column added next year is masked automatically instead of leaking until
somebody notices.

**Bias-sensitive fields are redacted for everyone, including admins.** Race,
gender identity, disability and veteran status, age band — masked for every
role, no exceptions. They stay in the database for anonymised aggregate
reporting only. Showing them on a screening screen puts bias exactly at the
point of decision.

**A `tech_lead` who is not on the panel gets `404`, not `403`.** `403` would
confirm that the candidate exists, which turns the endpoint into a probe for
enumerating applicants.

**Hard filters run before semantic search.** A cosine score of 0.94 does not
outrank a missing mandatory skill. Relevance and requirements are different
questions, and conflating them is how ranked search quietly recommends
unqualified people.

**The smoke test asserts outcomes, not status codes.**
`src/backend/scripts/smoke_flows.py` runs 35 checks against a real deployment:
ranking must be monotonically decreasing, a hard filter must actually shrink
the result set, `tech_lead` must *not* be able to read a candidate's name. It
has twice caught 500s that the entire unit-test suite passed straight through.

**Nothing reports success it did not achieve.** Email delivery returns `503`
with a reason when SMTP is unconfigured rather than a cheerful `true`;
notification results are written back to the database instead of only being set
on an in-memory object. An honest error beats a green light that means nothing.

**Row-level security is on.** The anon key ships inside the public JavaScript
bundle, so every table has RLS enabled except published job postings. Signed-in
screens go through `/api/catalog/*`, where the backend holds the service key
and decides authorisation itself.

---

## Architecture

```
   Candidate ──▶ /careers  ─┐
                            │        ┌──────────────────────────┐
   Recruiter ──▶ workspace ─┴──────▶ │  Next.js 15 (App Router) │
                                     └────────────┬─────────────┘
                                                  │  JWT access + refresh
                                                  ▼
                                     ┌──────────────────────────┐
                                     │  FastAPI · modules/*     │
                                     │  ABAC masking on egress  │
                                     └────────────┬─────────────┘
                    ┌─────────────────────────────┼──────────────────────┐
                    ▼                             ▼                      ▼
             ┌─────────────┐            ┌──────────────────┐     ┌───────────────┐
             │ Gemini      │            │ Supabase         │     │ GitHub API    │
             │ CV parsing  │            │ Postgres+pgvector│     │ Google Calendar│
             └─────────────┘            │ RLS enabled      │     │ Slack webhook │
                                        └──────────────────┘     └───────────────┘
                                                  ▲
                                        ┌──────────────────┐
                                        │ Azure Blob       │
                                        │ CV files         │
                                        └──────────────────┘
```

The backend is organised **by module, not by technical layer**. Each module
under `src/backend/modules/` owns its own `domain/`, `application/`,
`adapters/` and `infra/`, so one feature reads top to bottom in one place.

| Module | Responsibility |
| --- | --- |
| `auth` | Registration, email/password and Google sign-in, JWT issue and refresh |
| `ingestion` | CV upload, PDF extraction, Gemini parsing, application records |
| `enrichment` | GitHub enrichment, skills matrix, live progress over WebSocket |
| `scoring` | Job posting embeddings for semantic matching |
| `search` | Semantic candidate search: hard filters, then pgvector ranking |
| `review` | Review panels, approval threshold, decisions |
| `scheduling` | Sweep-line slot search over calendars, Google Calendar, Slack |
| `catalog` | Read models for signed-in screens (replaces direct PostgREST calls) |
| `admin` | User management, session revocation, ABAC policies, audit log |
| `shared` | Config, Supabase clients, auth dependencies, ABAC masking, rate limits |

**Stack** — Next.js 15 · React 19 · TypeScript (strict) · Tailwind ·
FastAPI · Pydantic v2 · `structlog` · Supabase (Postgres + pgvector) ·
Google Gemini · `sentence-transformers` (multilingual-e5-base) · LangGraph.

---

## Roles and permissions

Exactly three roles. `modules/shared/domain/roles.py` is the single source of
truth, mirrored 1:1 by `src/frontend/lib/rbac.ts`.

| Role | Access |
| --- | --- |
| `admin` | Admin Panel only — deliberately **excluded** from operational screens |
| `hr` | Full recruiting workflow, sees complete candidate data |
| `tech_lead` | The same screens as `hr`, but candidate PII is masked by the API |

Public registration lets you pick between `hr` and `tech_lead`. `admin` is not
self-assignable: the request model accepts only those two values and the
service checks again before touching the database. Admin accounts come from the
seed script or the Admin Panel.

---

## Run it locally

You only need this if you want to change the code — the deployed app is at
[smartats.tech](https://smartats.tech).

### Prerequisites

- **Python 3.10+** and **Node.js 20+**
- A **Supabase** project (URL, anon key, service key, service-role key)
- A **Google Gemini** API key for CV parsing
- ~3 GB free disk: the embedding model is ~1 GB and PyTorch another ~1.6 GB

### 1. Clone and install

```bash
git clone https://github.com/HDT-0103/Applicant_Tracking_System.git
cd Applicant_Tracking_System
```

```bash
python3 -m venv venv
./venv/bin/python -m pip install -r requirements.txt
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Four variables are **required** — the backend reads settings at import time, so
a missing one stops startup immediately instead of failing later on a request:

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
```

One more is required in practice, and its absence is nastier because the app
still starts and `/health` still answers: **`SUPABASE_SERVICE_KEY`**. It is a
*different* variable from `SUPABASE_SERVICE_ROLE_KEY` — the admin Supabase
client reads it straight from the environment. Without it, every route that
bypasses RLS (ingest, catalog, search, scheduling, review) silently gets `None`
and returns `503` or an empty list.

`tests/test_env_contract.py` fails if a required setting is missing from
`.env.example`, so the template cannot silently drift out of date.

### 3. Set up the database

Apply the numbered migrations in `src/backend/migrations/` to your Supabase
project (SQL editor or `psql`), then create an admin account:

```bash
./venv/bin/python src/backend/scripts/seed_admin.py
```

Defaults to `admin@smartats.com` / `Admin@123` — change the password right
after the first sign-in, or override `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`.

`docs/RLS_RUNBOOK.md` walks through enabling row-level security, and
`docs/supabase_schema.md` is the table reference.

### 4. Run

```bash
./start_backend.sh
```

```bash
npm run dev
```

Backend on <http://localhost:8000> (API docs at `/docs`), frontend on
<http://localhost:3000>.

On Windows, or if you prefer to type it out:

```bash
PYTHONPATH="$(pwd)/src:$(pwd)/src/backend" ./venv/bin/python -m uvicorn apps.main:app --reload --port 8000 --app-dir src/backend
```

Both paths matter: the repo mixes three import prefixes (`modules.*`, `app.*`,
`src.backend.app.*`), and `--app-dir` alone does not cover all of them.

> The first semantic search of a process loads the embedding model — about
> **7 seconds and ~1 GB of RAM**, cached for the lifetime of the process. That
> is also why the backend cannot run on serverless platforms.

---

## A tour of the API

Full interactive docs at `/docs` when the backend is running. The operational
endpoints accept **`hr` and `tech_lead` only** — an `admin` token gets `403`
there by design.

**Register and get a token** (pick `hr` or `tech_lead`):

```bash
curl -s -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"HR Demo","email":"hr.demo@example.com","password":"Demo@12345","role":"hr"}'
```

**Submit a CV** — public, no token, PDF only, 10 MB maximum:

```bash
curl -s -X POST http://localhost:8000/api/v1/ingest \
  -F "file=@cv.pdf;type=application/pdf" -F "job_id=<JOB_ID>"
```

**Search candidates semantically:**

```bash
curl -s -X POST http://localhost:8000/api/search \
  -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"summary":"senior backend engineer, distributed systems","required_skills":["Go"],"top_k":10}'
```

**Enrich a candidate from GitHub** (runs in the background, 5–30 s):

```bash
curl -s -X POST http://localhost:8000/api/enrichment/<UUID>/sync -H "Authorization: Bearer <TOKEN>"
curl -s      http://localhost:8000/api/enrichment/<UUID>       -H "Authorization: Bearer <TOKEN>"
```

Live progress for the same job is available over
`ws://localhost:8000/api/enrichment/ws/v1/analysis/<UUID>`; the first frame the
client sends must be the access token.

---

## Testing

```bash
./venv/bin/python -m pytest -q        # 375 backend tests
cd src/frontend && npm test -- --run  # 202 frontend tests
npm run typecheck                     # tsc --noEmit
npm run build                         # production build
```

Run pytest **from the repository root**: there are two test directories
(`tests/` and `src/backend/tests/`) and the root `conftest.py` puts both on the
path and loads `.env`. Tests that need a real Supabase project live in
`tests/integration/` and skip themselves unless `RUN_INTEGRATION_TESTS=true`.

Then there is the smoke test, which is a different kind of check — it runs
against a **running** system and asserts real outcomes:

```bash
./venv/bin/python src/backend/scripts/smoke_flows.py                       # local
BASE=https://<host> ./venv/bin/python src/backend/scripts/smoke_flows.py --jwt-secret "<secret>"
```

It creates one test candidate, tagged `[SMOKE]`, and cleans up after itself
(`--keep` to inspect the data). Against a remote deployment you must pass that
environment's `JWT_SECRET`, because the script signs its own tokens.

Scripts that need real API keys or human input live in `tests/manual/` and are
deliberately **not** named `test_*.py`: pytest imports such a file, finds no
test functions, reports nothing, and that reads exactly like a pass.

---

## Deployment

The frontend runs on Vercel, the backend on Azure Container Apps.
**[`docs/DEPLOY.md`](docs/DEPLOY.md)** (in Vietnamese) is the full runbook:
first-time infrastructure, shipping a new version, custom domains,
troubleshooting, and the traps that cost this team time.

The backend is a long-lived container by necessity, not preference: the
embedding model is cached in-process, enrichment continues in
`BackgroundTasks` after the response is sent, and there is a WebSocket. None of
those survive a serverless function.

---

## Configuration

The full list is in `.env.example`. The ones that matter most:

| Variable | Default | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | — | Required. |
| `SUPABASE_ANON_KEY` | — | Required. Public; subject to RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required. Bypasses RLS — backend only, never the frontend. |
| `SUPABASE_SERVICE_KEY` | — | Required in practice. Read directly by the admin client; see above. |
| `JWT_SECRET` | — | Required. Use a fresh value per environment. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated. Every deployed frontend origin must be listed. |
| `GEMINI_API_KEY` | — | CV parsing. Without it, applications are created empty. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Pinned deliberately; Google removes older models. |
| `GITHUB_API_TOKEN` | — | Needs `public_repo`. An expired token makes enrichment return empty scores. |
| `AZURE_STORAGE_CONNECTION_STRING` | — | Where CV files are stored. |
| `SLACK_WEBHOOK_URL` | — | Optional. Interview confirmations. |
| `SMTP_*` | — | Optional. Unset means `send_room_details` returns `503` with a reason. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh rotates the token, so an active user is never signed out. |
| `MAX_UPLOAD_MB` | `10` | |

---

## Known limitations

Written down rather than hidden — most of these are deliberate trade-offs made
under a course deadline.

- **Two data paths on the frontend.** Newer screens call the backend API with a
  JWT; a few older ones still query Supabase directly with the anon key. They
  disagree about session state, so part of the app can keep working after a
  session dies.
- **`src/backend/app/` is a second, older tree.** SQLAlchemy models and
  LangGraph pipelines coexist with the Supabase SDK. `modules/search` bridges
  the two; new work belongs in `modules/`.
- **Public signup grants an operational role.** Anyone can create an `hr` or
  `tech_lead` account. Panel gating and ABAC limit what a fresh `tech_lead` can
  actually see, but this would need an approval queue in production.
- **LinkedIn enrichment is disabled.** It requires a paid Apify token.
- **Responsive layout is thin.** The app targets desktop.
- **PyTorch cannot be upgraded on Intel macOS** — upstream stopped publishing
  x86_64 wheels after 2.2.2. The remaining advisories are a platform limit, not
  a choice.

---

## License

[MIT](LICENSE) — use it, fork it, learn from it.
