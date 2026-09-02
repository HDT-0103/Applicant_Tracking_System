#!/usr/bin/env python3
"""Gán Tech Lead vào hội đồng chấm của tin tuyển dụng.

    ./venv/bin/python src/backend/scripts/assign_review_panels.py            # xem hiện trạng
    ./venv/bin/python src/backend/scripts/assign_review_panels.py --all      # mời MỌI tech lead vào MỌI tin chưa có hội đồng
    ./venv/bin/python src/backend/scripts/assign_review_panels.py --job <id> --reviewer <id>

## Vì sao cần script này

Từ V008, hồ sơ chỉ đi tiếp khi tin tuyển dụng có hội đồng chấm. Những tin tạo
TRƯỚC migration không có ai — và hệ quả không hiện ra ở đâu cả: hồ sơ nằm im ở
`waiting_for_tls`, tech lead mở hồ sơ thì nhận 404, và không có thông báo nào
nói vì sao. Nhìn từ giao diện, hệ thống trông như đang hỏng.

Cách đúng cho tin MỚI là HR chọn người ngay ở màn hình tạo tin (Step 3). Script
này lo phần dữ liệu CŨ, và để kiểm tra nhanh xem còn tin nào bị bỏ quên.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
for _p in (_ROOT, _ROOT / "src", _ROOT / "src" / "backend"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from dotenv import load_dotenv

    load_dotenv(_ROOT / ".env", override=False)
except ImportError:
    pass

from modules.review.domain import policy  # noqa: E402
from modules.shared.infrastructure.config import get_settings  # noqa: E402
from modules.shared.infrastructure.supabase_client import get_supabase_client  # noqa: E402

GREEN, RED, YELLOW, DIM, BOLD, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[1m", "\033[0m"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true",
                        help="Mời mọi tech lead vào mọi tin chưa có hội đồng")
    parser.add_argument("--job", help="Chỉ tác động lên một tin tuyển dụng")
    parser.add_argument("--reviewer", help="Chỉ mời một tech lead")
    args = parser.parse_args()

    client = get_supabase_client(get_settings(), use_admin=True)
    if client is None:
        print(f"{RED}Supabase chưa cấu hình.{RESET}")
        return 1

    reviewers = (
        client.table("users").select("id, name, email")
        .eq("role", "tech_lead").eq("is_active", True).eq("is_approved", True)
        .order("name").execute().data or []
    )
    jobs = (
        client.table("jobs_posting").select("id, job_title, status")
        .order("created_at", desc=True).execute().data or []
    )
    if args.job:
        jobs = [j for j in jobs if j["id"] == args.job]
    if args.reviewer:
        reviewers = [r for r in reviewers if r["id"] == args.reviewer]

    if not reviewers:
        print(f"{RED}Không có tech lead nào đang hoạt động và đã được duyệt.{RESET}")
        print(f"{DIM}Tạo tài khoản qua /register rồi để admin duyệt ở /admin.{RESET}")
        return 1

    assignments = client.table("job_posting_reviewers").select(
        "job_posting_id, reviewer_id"
    ).execute().data or []
    by_job: dict[str, set[str]] = {}
    for a in assignments:
        by_job.setdefault(a["job_posting_id"], set()).add(a["reviewer_id"])

    hr = (
        client.table("users").select("id").eq("role", "hr").limit(1).execute().data or []
    )
    if not hr and args.all:
        print(f"{RED}Không tìm thấy tài khoản HR nào để ghi vào invited_by.{RESET}")
        return 1
    invited_by = hr[0]["id"] if hr else None

    print(f"{BOLD}Tech Lead khả dụng ({len(reviewers)}){RESET}")
    for r in reviewers:
        print(f"   {r['id']}  {r['name']} <{r['email']}>")

    print(f"\n{BOLD}Tin tuyển dụng{RESET}")
    empty_published = []
    for job in jobs:
        current = by_job.get(job["id"], set())
        need = policy.required_approvals(len(current)) if current else 0
        mark = GREEN if current else (RED if job["status"] == "PUBLISHED" else YELLOW)
        state = f"{len(current)} người, cần {need} duyệt" if current else "CHƯA CÓ HỘI ĐỒNG"
        print(f"   {mark}{job['status']:10}{RESET} {job['job_title'][:40]:42} {state}")
        if not current and job["status"] == "PUBLISHED":
            empty_published.append(job)

    if not args.all and not (args.job and args.reviewer):
        if empty_published:
            print(f"\n{RED}{len(empty_published)} tin ĐANG NHẬN HỒ SƠ mà chưa có ai chấm.{RESET}")
            print(f"{DIM}Hồ sơ nộp vào đó sẽ nằm im ở waiting_for_tls và tech lead nhận 404.{RESET}")
            print(f"\nChạy lại với {BOLD}--all{RESET} để mời mọi tech lead vào những tin đó.")
            return 1
        print(f"\n{GREEN}Mọi tin đang nhận hồ sơ đều đã có hội đồng.{RESET}")
        return 0

    targets = jobs if (args.job and args.reviewer) else empty_published
    added = 0
    for job in targets:
        for r in reviewers:
            if r["id"] in by_job.get(job["id"], set()):
                continue
            client.table("job_posting_reviewers").upsert(
                {
                    "job_posting_id": job["id"],
                    "reviewer_id": r["id"],
                    "invited_by": invited_by or r["id"],
                },
                on_conflict="job_posting_id,reviewer_id",
            ).execute()
            print(f"   {GREEN}+{RESET} {r['name']} -> {job['job_title'][:40]}")
            added += 1

    print(f"\n{GREEN}Đã thêm {added} phân công.{RESET}")
    if added:
        size = len(reviewers)
        print(f"{DIM}Hội đồng {size} người -> cần {policy.required_approvals(size)} phiếu duyệt "
              f"({int(policy.TL_APPROVAL_RATIO * 100)}%).{RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
