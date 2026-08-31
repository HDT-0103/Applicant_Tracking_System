"""
Verify that the Supabase schema has everything the public application form writes.

Run before and after applying V004__application_screening.sql:

    ./venv/bin/python src/backend/scripts/check_screening_schema.py

Reads SUPABASE_URL / SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) from .env.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

# Columns the careers page writes, per table.
REQUIRED = {
    "candidates": [
        "uuid", "full_name", "email", "phone", "current_location", "current_company",
        "pronouns", "custom_pronouns", "linkedin_url", "github_username", "github_url",
        "portfolio_url", "website_url", "university", "faculty_program", "graduation_year",
        "age_group", "gender_identity", "race", "military_status", "disability_status",
        "cv_file_path", "salary_expectation", "education_level",
    ],
    "resumes": ["candidate_uuid", "filename", "file_path"],
    "jobs_posting": ["id", "job_title", "status", "expires_at", "must_have_skills", "nice_to_have_skills"],
    "applications": [
        "candidate_uuid", "job_posting_id", "resume_id",
        "work_authorization", "office_attendance", "referral_source",
        "preferred_talent_network", "additional_information",
        # Added by V004
        "expected_salary_min", "expected_salary_max", "salary_basis", "work_mode_pref",
        "availability_bucket", "availability_date", "experience_bucket", "skill_ratings",
        "portfolio_url", "proudest_project", "motivation_reason", "motivation_other",
        "conflict_story", "work_style", "consent_data_sharing", "consent_at",
    ],
}


def load_env() -> dict[str, str]:
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        sys.exit(f"No .env found at {env_path}")
    env: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def fetch_schema(url: str, key: str) -> dict:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/openapi+json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        spec = json.load(response)
    return spec.get("definitions") or spec.get("components", {}).get("schemas", {})


def main() -> int:
    env = load_env()
    url = env.get("SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = (
        env.get("SUPABASE_SERVICE_KEY")
        or env.get("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
    )
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY must be set in .env")

    tables = fetch_schema(url, key)
    missing_total = 0

    for table, columns in REQUIRED.items():
        if table not in tables:
            print(f"MISSING TABLE  {table}")
            missing_total += len(columns)
            continue
        present = set(tables[table].get("properties", {}))
        missing = [c for c in columns if c not in present]
        if missing:
            missing_total += len(missing)
            print(f"FAIL  {table}: missing {len(missing)} column(s)")
            for column in missing:
                print(f"        - {column}")
        else:
            print(f"OK    {table}: all {len(columns)} columns present")

    if missing_total:
        print(f"\n{missing_total} column(s) missing. Apply src/backend/migrations/V004__application_screening.sql.")
        return 1

    print("\nSchema is ready for the application form.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
