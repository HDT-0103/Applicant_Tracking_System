#!/usr/bin/env python3
"""
Setup script for PostgreSQL/Supabase schema used by SmartATS enrichment pipeline.
Creates the candidate_profiles table and indexes if using raw PostgreSQL.
For Supabase, run the equivalent SQL in the SQL Editor.
"""

import sys
from pathlib import Path

backend_path = Path(__file__).parent.parent.parent.parent / "src" / "backend"
sys.path.insert(0, str(backend_path))

from modules.shared.infrastructure.config import get_settings


REQUIRED_TABLES_SQL = """
-- Core candidate profiles table (used by enrichment module)
CREATE TABLE IF NOT EXISTS candidate_profiles (
    candidate_uuid UUID PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    experience JSONB DEFAULT '[]'::jsonb,
    education JSONB DEFAULT '[]'::jsonb,
    projects JSONB DEFAULT '[]'::jsonb,
    certifications JSONB DEFAULT '[]'::jsonb,
    languages JSONB DEFAULT '[]'::jsonb,
    seniority_level TEXT,
    total_years_experience NUMERIC,
    github_username TEXT,
    linkedin_url TEXT,
    github_data JSONB,
    linkedin_data JSONB,
    embedding JSONB,
    parsed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_email ON candidate_profiles (email);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_github ON candidate_profiles (github_username);

-- Linkedin scraped profiles
CREATE TABLE IF NOT EXISTS linkedin_profiles (
    candidate_uuid UUID PRIMARY KEY REFERENCES candidate_profiles(candidate_uuid),
    profile_url TEXT,
    headline TEXT,
    location TEXT,
    industry TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    experience JSONB DEFAULT '[]'::jsonb,
    education JSONB DEFAULT '[]'::jsonb,
    endorsements JSONB DEFAULT '{}'::jsonb,
    connections_count INTEGER,
    profile_picture_url TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (for auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'interviewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
"""


def main():
    settings = get_settings()
    db_url = settings.database_url

    print(f"Database URL configured: {db_url[:db_url.find('@')+1] if '@' in db_url else 'localhost'}")

    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.begin() as conn:
            for statement in REQUIRED_TABLES_SQL.split(";"):
                stmt = statement.strip()
                if stmt:
                    conn.execute(text(stmt))
        print("Schema setup completed successfully!")
        print("Tables created/verified: candidate_profiles, linkedin_profiles, users")
    except ImportError:
        print("SQLAlchemy not installed. Run the following SQL in your database:")
        print(REQUIRED_TABLES_SQL)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
