# pgvector / Supabase Optimization Guide for SmartATS

## Overview

SmartATS uses Supabase (PostgreSQL) as its primary database. While pgvector is configured via `DATABASE_URL` and `PGVECTOR_EXTENSION_ENABLED` in `.env.example`, the current implementation stores candidate profiles in Supabase's `candidate_profiles` table with JSONB columns. Vector embeddings are optional and stored as JSONB.

## Current Schema (Supabase)

### `candidate_profiles` table
```sql
CREATE TABLE candidate_profiles (
    candidate_uuid UUID PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    skills JSONB DEFAULT '[]',
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    projects JSONB DEFAULT '[]',
    certifications JSONB DEFAULT '[]',
    languages JSONB DEFAULT '[]',
    seniority_level TEXT,
    total_years_experience NUMERIC,
    github_username TEXT,
    linkedin_url TEXT,
    github_data JSONB,
    linkedin_data JSONB,
    embedding JSONB,          -- Optional: vector as JSONB array
    parsed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `linkedin_profiles` table
```sql
CREATE TABLE linkedin_profiles (
    candidate_uuid UUID PRIMARY KEY REFERENCES candidate_profiles(candidate_uuid),
    profile_url TEXT,
    headline TEXT,
    location TEXT,
    industry TEXT,
    skills JSONB DEFAULT '[]',
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    endorsements JSONB DEFAULT '{}',
    connections_count INTEGER,
    profile_picture_url TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Current Storage Pattern

- **CV binary files**: Stored in **Azure Blob Storage**, not in the database
- **Candidate metadata**: Stored in **Supabase** JSONB columns for flexibility
- **Enrichment results**: Stored in-memory (`candidate_enrichments` dict) during processing, then optionally persisted to Supabase
- **Embeddings**: Optional, stored as JSONB array (not pgvector type unless raw PostgreSQL is used)

## If Using pgvector (Raw PostgreSQL)

If you migrate from Supabase to raw PostgreSQL with pgvector:

### Index Types

```sql
-- IVFFlat (recommended for <100K vectors)
CREATE INDEX idx_profiles_embedding
ON candidate_profiles USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- HNSW (recommended for >100K vectors)
CREATE INDEX idx_profiles_embedding_hnsw
ON candidate_profiles USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Similarity Search

```sql
-- Cosine similarity (recommended for text embeddings)
SELECT candidate_uuid, full_name,
       1 - (embedding::vector <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM candidate_profiles
WHERE embedding IS NOT NULL
ORDER BY embedding::vector <=> '[0.1, 0.2, ...]'::vector
LIMIT 20;
```

## Best Practices for Current Setup

1. **Use JSONB indexes** for frequently queried fields:
   ```sql
   CREATE INDEX idx_profiles_email ON candidate_profiles (email);
   CREATE INDEX idx_profiles_github ON candidate_profiles (github_username);
   ```

2. **Store large text in Azure Blob**, not PostgreSQL (PDF files, raw text)

3. **Use `ON CONFLICT` (UPSERT)** for candidate updates:
   ```python
   supabase.table('candidate_profiles').upsert(data, on_conflict='candidate_uuid').execute()
   ```

4. **Monitor Supabase row limits** (free tier: 500MB / 50,000 rows)
