---
name: database-schema-standards
description: Enterprise PostgreSQL and Supabase database schema standards, indexing strategies, RLS security policies, migration patterns, and audit logging for SmartATS
version: 2.0.0
author: SmartATS Database Architecture Team
tech_stack:
  - PostgreSQL 15+
  - Supabase Database & Auth
  - PL/pgSQL Triggers
when_to_use:
  - "create or alter Supabase PostgreSQL tables"
  - "write SQL migrations or schema definitions"
  - "configure Row Level Security (RLS) policies"
  - "design foreign key indexes and JSONB indexes"
  - "implement database audit logs or soft delete mechanisms"
---

# Database Schema & Data Architecture Standards

## 1. Architectural Principles

SmartATS uses Supabase (PostgreSQL 15+) as its central database. All schema changes must adhere to strict enterprise data standards to maintain performance, ACID compliance, data integrity, and multi-tenant security.

---

## 2. Naming & Type Conventions

### Naming Standards
- **Tables**: `snake_case`, plural noun names (e.g., `users`, `candidates`, `github_profiles`, `linkedin_profiles`).
- **Columns**: `snake_case` (e.g., `candidate_uuid`, `full_name`, `cv_file_path`, `top_languages`).
- **Foreign Keys**: `candidate_uuid` or `singular_table_name_id`.
- **Indexes**: `idx_{table}_{column(s)}` (e.g., `idx_candidates_email`, `idx_github_profiles_candidate_uuid`).
- **Custom Types/Enums**: `snake_case` (e.g., `public.role_type`).

### Data Types & Constraints
- **Primary Keys**: Always use `UUID` with `gen_random_uuid()` (or `uuid` string for candidate records).
- **Timestamps**: Always use `TIMESTAMPTZ` (Timestamp with time zone) defaulting to `NOW()`.
- **Text & Strings**: Prefer `text` or `varchar`.
- **JSON Data**: Use `JSONB` for unstructured external payloads (`github_profiles.repos`, `linkedin_profiles.experiences`, `linkedin_profiles.educations`).

---

## 3. Core Schema Structure Reference (`public`)

```sql
-- 1. Role Type Enum
CREATE TYPE public.role_type AS ENUM ('admin', 'hr_manager', 'tech_lead', 'interviewer', 'candidate');

-- 2. Users Table
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

-- 3. Candidates Table
CREATE TABLE public.candidates (
  uuid varchar NOT NULL,
  full_name varchar,
  email varchar,
  phone varchar,
  github_username varchar,
  linkedin_url text,
  cv_file_path text,
  status varchar NOT NULL DEFAULT 'CREATED'::varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidates_pkey PRIMARY KEY (uuid)
);

-- 4. GitHub Profiles Table
CREATE TABLE public.github_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid varchar NOT NULL,
  public_repos_count integer DEFAULT 0,
  top_languages jsonb DEFAULT '{}'::jsonb,
  readme_content text,
  repos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT uq_github_profile_candidate UNIQUE (candidate_uuid),
  CONSTRAINT fk_github_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid) ON DELETE CASCADE
);

-- 5. LinkedIn Profiles Table
CREATE TABLE public.linkedin_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid varchar NOT NULL,
  full_name varchar,
  headline text,
  profile_url text,
  avatar_url text,
  experiences jsonb DEFAULT '[]'::jsonb,
  educations jsonb DEFAULT '[]'::jsonb,
  certifications jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT uq_linkedin_profile_candidate UNIQUE (candidate_uuid),
  CONSTRAINT fk_linkedin_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid) ON DELETE CASCADE
);
```

---

## 4. Indexing & JSONB Optimization

### Standard B-Tree Indexes
Always index foreign keys and frequently queried filter columns:
```sql
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_github_profiles_candidate_uuid ON public.github_profiles(candidate_uuid);
CREATE INDEX idx_linkedin_profiles_candidate_uuid ON public.linkedin_profiles(candidate_uuid);
```

### JSONB GIN Indexes
For querying inside JSONB profile fields:
```sql
CREATE INDEX idx_github_profiles_top_languages ON public.github_profiles USING GIN (top_languages);
```

---

## 5. Row Level Security (RLS) & Audit Logging

### Row Level Security Policy
All public tables MUST enable RLS in production:
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with allowed role read access
CREATE POLICY p_admin_hr_read_access ON public.candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = auth.email()
      AND users.role IN ('admin', 'hr_manager', 'tech_lead', 'recruiter')
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

