---
name: database-schema-standards
description: Enterprise PostgreSQL and Supabase database schema standards, indexing strategies, RLS security policies, migration patterns, and audit logging for SmartATS
version: 2.0.0
author: SmartATS Database Architecture Team
tech_stack:
  - PostgreSQL 15+
  - Supabase Database & Auth
  - pgvector (Vector Embeddings)
  - PL/pgSQL Triggers
when_to_use:
  - "create or alter Supabase PostgreSQL tables"
  - "write SQL migrations or schema definitions"
  - "configure Row Level Security (RLS) policies"
  - "design foreign key indexes and vector search indexes"
  - "implement database audit logs or soft delete mechanisms"
---

# Database Schema & Data Architecture Standards

## 1. Architectural Principles

SmartATS uses Supabase (PostgreSQL 15+) as its central relational and vector database. All schema changes must adhere to strict enterprise data standards to maintain performance, ACID compliance, data integrity, and multi-tenant security.

---

## 2. Naming & Type Conventions

### Naming Standards
- **Tables**: `snake_case`, plural noun names (e.g., `candidates`, `jobs_posting`, `applications`, `audit_logs`).
- **Columns**: `snake_case` (e.g., `full_name`, `created_at`, `match_confidence_score`).
- **Foreign Keys**: `singular_table_name_id` or `candidate_uuid` (e.g., `job_posting_id`, `candidate_uuid`, `resume_id`).
- **Indexes**: `idx_{table}_{column(s)}` (e.g., `idx_applications_candidate_uuid`, `idx_candidates_email`).
- **Custom Types/Enums**: `snake_case` (e.g., `public.role_type`, `public.application_status`).

### Data Types & Constraints
- **Primary Keys**: Always use `UUID` with `gen_random_uuid()` default (or `candidate_uuid` string for legacy compatibility).
- **Timestamps**: Always use `TIMESTAMPTZ` (Timestamp with time zone) defaulting to `NOW()`.
- **Text & Strings**: Prefer `text` or `varchar(255)`. Avoid unbounded arbitrary varchar limits without domain reason.
- **JSON Data**: Use `JSONB` for unstructured external payloads (e.g., `github_profiles.repos`, `linkedin_profiles.experiences`).

---

## 3. Core Schema Structure Reference (`public`)

```sql
-- 1. Users Table
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  role public.role_type NOT NULL DEFAULT 'interviewer'::role_type,
  picture text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- 2. Candidates Table
CREATE TABLE public.candidates (
  uuid varchar NOT NULL,
  full_name varchar,
  email varchar,
  github_username varchar,
  linkedin_url text,
  status varchar NOT NULL DEFAULT 'CREATED'::varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidates_pkey PRIMARY KEY (uuid)
);

-- 3. Applications Table
CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid varchar NOT NULL,
  job_posting_id uuid NOT NULL,
  resume_id uuid NOT NULL,
  status varchar NOT NULL DEFAULT 'SUBMITTED'::varchar,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT fk_application_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid) ON DELETE CASCADE,
  CONSTRAINT fk_application_job_posting FOREIGN KEY (job_posting_id) REFERENCES public.jobs_posting(id) ON DELETE CASCADE
);

-- 4. Embeddings Table (Vector Search)
CREATE TABLE public.embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrichment_profile_id uuid NOT NULL,
  source_type varchar NOT NULL,
  text_content text NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_embeddings_enrichment_profile FOREIGN KEY (enrichment_profile_id) REFERENCES public.enrichment_profiles(id) ON DELETE CASCADE
);
```

---

## 4. Indexing & Vector Search Optimization

### Standard B-Tree Indexes
Always index foreign keys and frequently queried filter columns:
```sql
CREATE INDEX idx_applications_candidate_uuid ON public.applications(candidate_uuid);
CREATE INDEX idx_applications_job_posting_id ON public.applications(job_posting_id);
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_enrichment_profiles_status ON public.enrichment_profiles(enrichment_status);
```

### JSONB GIN Indexes
For querying inside JSONB profile fields:
```sql
CREATE INDEX idx_github_profiles_top_languages ON public.github_profiles USING GIN (top_languages);
```

### Vector Similarity Index (pgvector)
For semantic embedding similarity search (`multilingual-e5-base` 768 dimensions):
```sql
CREATE INDEX idx_embeddings_vector ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 5. Row Level Security (RLS) & Audit Logging

### Row Level Security Policy
All public tables MUST enable RLS in production:
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with admin or hr role full read access
CREATE POLICY p_admin_hr_full_access ON public.candidates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = auth.email()
      AND users.role IN ('admin', 'hr', 'hr_manager', 'recruiter')
    )
  );
```

### Updated Timestamp Trigger
Automate `updated_at` timestamps on modification:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_candidates_updated_at
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. AI Agent Guidelines for Database Modification

### When Should AI Load This Skill?
Load this skill whenever generating SQL migrations, modifying Pydantic database models in `modules/shared/domain/supabase_models.py`, or designing new tables and indexes.

### Which Other Skills Should Be Loaded Together?
- `ats-business-domain` (for domain entity relationships)
- `shared-infrastructure` (for Supabase client instantiation)
- `security-governance` (for RLS and audit compliance)

### Common Anti-Patterns & Mistakes to Avoid
- **Missing Foreign Key Indexes**: Forgetting to index FK columns causes full table scans during joins.
- **Exposing Service Role Key**: Never put `SUPABASE_SERVICE_KEY` in frontend client code. Service key bypasses RLS and should only be used by backend services.
- **Unbounded JSONB Growth**: Storing giant raw files in JSONB instead of storing files in Azure Blob Storage / Supabase Storage.
