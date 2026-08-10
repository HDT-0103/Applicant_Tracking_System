"""
Verify that the Supabase schema has the job_embeddings table from V006.

Run before and after applying V006__job_embeddings.sql:

    ./venv/bin/python src/backend/scripts/check_job_embeddings_schema.py

Reads SUPABASE_URL / SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) from .env.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

REQUIRED = {
    "job_embeddings": [
        "id", "job_posting_id", "source_type", "text_content",
        "embedding", "model_name", "created_at",
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
        print(f"\n{missing_total} column(s) missing. Apply src/backend/migrations/V006__job_embeddings.sql.")
        return 1

    print("\njob_embeddings schema is ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
