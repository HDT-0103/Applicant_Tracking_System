"""
Backfill job_embeddings for existing job postings.

Embeds every PUBLISHED job (default), or every job with --all. Jobs whose
embeddings are already current are skipped unless --force. Use after applying
V006, and again whenever the embedding model changes.

    ./venv/bin/python src/backend/scripts/backfill_job_embeddings.py
    ./venv/bin/python src/backend/scripts/backfill_job_embeddings.py --all --force

Requires SUPABASE_URL / SUPABASE_SERVICE_KEY in .env. First run downloads the
e5-base model (~1.1GB).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
for path in (REPO_ROOT / "src", REPO_ROOT / "src" / "backend"):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from modules.scoring.application.job_embedding_service import ensure_job_embeddings  # noqa: E402
from modules.shared.infrastructure.config import get_settings  # noqa: E402
from modules.shared.infrastructure.supabase_client import get_supabase_client  # noqa: E402


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="embed every job, not just PUBLISHED")
    parser.add_argument("--force", action="store_true", help="re-embed even if up to date")
    args = parser.parse_args()

    settings = get_settings()
    client = get_supabase_client(settings, use_admin=True)
    if client is None:
        sys.exit("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY in .env)")

    query = client.table("jobs_posting").select("id,job_title,status")
    if not args.all:
        query = query.eq("status", "PUBLISHED")
    jobs = query.order("created_at", desc=True).execute().data or []

    if not jobs:
        print("No job postings found.")
        return 0

    print(f"{len(jobs)} job(s) to process\n")
    embedded = skipped = failed = 0
    for job in jobs:
        label = f"{job['id']}  [{job.get('status')}] {job.get('job_title')}"
        try:
            result = await ensure_job_embeddings(job["id"], settings, force=args.force)
        except Exception as exc:  # noqa: BLE001 - keep going, report at the end
            failed += 1
            print(f"FAIL  {label}: {exc}")
            continue
        if result.skipped:
            skipped += 1
            print(f"SKIP  {label}")
        else:
            embedded += 1
            print(f"OK    {label}  -> {', '.join(result.embedded)}")

    print(f"\nembedded={embedded} skipped={skipped} failed={failed} (model per rows: see job_embeddings.model_name)")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
