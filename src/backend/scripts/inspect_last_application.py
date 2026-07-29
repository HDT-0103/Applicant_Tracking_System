"""
Show the most recent application(s) so a UI test can be verified from the terminal.

    ./venv/bin/python src/backend/scripts/inspect_last_application.py
    ./venv/bin/python src/backend/scripts/inspect_last_application.py --limit 3

Confirms the thing that matters most: the CV landed on the job whose link was used.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

SCREENING_FIELDS = [
    "expected_salary_min", "expected_salary_max", "salary_basis", "work_mode_pref",
    "availability_bucket", "availability_date", "experience_bucket", "skill_ratings",
    "portfolio_url", "proudest_project", "motivation_reason", "motivation_other",
    "conflict_story", "work_style", "consent_data_sharing", "consent_at",
]


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


def get(url: str, key: str, path: str, params: dict[str, str]) -> list[dict]:
    query = urllib.parse.urlencode(params, safe="*(),.")
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{path}?{query}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def show(value) -> str:
    if value is None:
        return "-"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=1, help="how many recent applications to show")
    args = parser.parse_args()

    env = load_env()
    url = env.get("SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_KEY") or env.get("SUPABASE_ANON_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY must be set in .env")

    applications = get(url, key, "applications", {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(args.limit),
    })

    if not applications:
        print("No applications yet.")
        return 0

    for i, app in enumerate(applications):
        if i:
            print()
        print("=" * 68)

        jobs = get(url, key, "jobs_posting", {
            "select": "id,job_title,status,expires_at",
            "id": f"eq.{app['job_posting_id']}",
        })
        job = jobs[0] if jobs else {}

        candidates = get(url, key, "candidates", {
            "select": "uuid,full_name,email,github_url,education_level,graduation_year,salary_expectation",
            "uuid": f"eq.{app['candidate_uuid']}",
        })
        candidate = candidates[0] if candidates else {}

        print(f"APPLIED TO   {job.get('job_title', '?')}   [{job.get('status', '?')}]")
        print(f"  job id     {app['job_posting_id']}")
        print(f"  submitted  {app.get('submitted_at') or app.get('created_at')}")

        print("\nCANDIDATE")
        for field in ("full_name", "email", "github_url", "education_level", "graduation_year", "salary_expectation"):
            print(f"  {field:22} {show(candidate.get(field))}")

        print("\nSCREENING ANSWERS")
        missing = [f for f in SCREENING_FIELDS if f not in app]
        if missing:
            print(f"  !! {len(missing)} column(s) absent — V004 not applied: {', '.join(missing)}")
        for field in SCREENING_FIELDS:
            if field in app:
                print(f"  {field:22} {show(app[field])}")

        if not app.get("consent_data_sharing"):
            print("\n  !! consent_data_sharing is false — the form should never allow this.")

    print("=" * 68)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
