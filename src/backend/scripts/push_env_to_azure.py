#!/usr/bin/env python3
"""Đẩy cấu hình từ `.env` lên Azure Container Apps, không lộ giá trị ra màn hình.

    ./venv/bin/python src/backend/scripts/push_env_to_azure.py \
        --app smartats-backend --resource-group smartats-rg \
        --frontend-url https://smartats.vercel.app

    # xem trước, không gọi az:
    ./venv/bin/python src/backend/scripts/push_env_to_azure.py ... --dry-run

## Vì sao không copy-paste tay

Có 12 khoá phải đưa lên, và một trong số đó —
`AZURE_STORAGE_CONNECTION_STRING` — chứa cả `;` lẫn `=`. Trong `.env` nó không
được đặt trong nháy, nên `source .env` sẽ hiểu `;` là dấu ngắt lệnh và chạy
`AccountName=...` như một lệnh riêng. Copy tay thì hoặc thiếu khoá, hoặc đứt
chuỗi ở giữa, và cả hai kiểu hỏng chỉ lộ ra khi có người bấm vào màn hình.

Script đọc `.env` bằng dotenv (hiểu đúng dấu nháy và ký tự đặc biệt), rồi
truyền thẳng cho `az` qua argv. Giá trị KHÔNG bao giờ được in ra — chỉ in tên
biến kèm trạng thái đặt/bỏ qua.

## `JWT_SECRET` luôn là giá trị MỚI

Không lấy từ `.env`: ai cầm được nó thì ký được token cho bất kỳ role nào, kể
cả `admin`, và bản `.env` dev đã nằm trên máy nhiều người. Script sinh mới bằng
`secrets.token_hex(32)` ở lần chạy đầu, rồi GIỮ NGUYÊN ở các lần sau — sinh lại
mỗi lần deploy sẽ đá văng mọi phiên đăng nhập đang mở.
"""
from __future__ import annotations

import argparse
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]

try:
    from dotenv import dotenv_values
except ModuleNotFoundError:  # pragma: no cover - phụ thuộc đã có trong requirements
    print("Thiếu python-dotenv. Chạy: ./venv/bin/pip install python-dotenv", file=sys.stderr)
    raise SystemExit(1)


# Biến -> tên secret trên Container App. Tên secret chỉ được gồm chữ thường,
# số và dấu gạch ngang, nên không dùng lại tên biến môi trường được.
SECRETS: dict[str, str] = {
    "SUPABASE_URL": "supabase-url",
    "SUPABASE_ANON_KEY": "supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "supabase-service-role-key",
    # HAI tên khác nhau, KHÔNG phải trùng lặp — thiếu cái này là hỏng nửa hệ
    # thống. `Settings` đòi SUPABASE_SERVICE_ROLE_KEY, còn client admin trong
    # `modules/shared/infrastructure/supabase_client.py` đọc thẳng biến môi
    # trường SUPABASE_SERVICE_KEY. Thiếu nó thì app vẫn khởi động và /health
    # vẫn xanh, nhưng mọi route dùng client admin — ingest, catalog, search,
    # scheduling, review — nhận `None` và trả 503 hoặc rỗng.
    "SUPABASE_SERVICE_KEY": "supabase-service-key",
    "AZURE_STORAGE_CONNECTION_STRING": "azure-storage",
    "GOOGLE_CLIENT_ID": "google-client-id",
    "GOOGLE_CLIENT_SECRET": "google-client-secret",
    "GEMINI_API_KEY": "gemini-api-key",
    "GROQ_API_KEY": "groq-api-key",
    "GITHUB_API_TOKEN": "github-api-token",
    "APIFY_API_TOKEN": "apify-api-token",
    "SLACK_WEBHOOK_URL": "slack-webhook",
    "SMTP_USERNAME": "smtp-username",
    "SMTP_PASSWORD": "smtp-password",
}

# Bốn biến bắt buộc để app khởi động (modules/shared/infrastructure/config.py).
# JWT_SECRET không nằm đây vì script tự sinh.
#
# SUPABASE_SERVICE_KEY không nằm trong `Settings` nhưng vẫn bắt buộc: thiếu nó
# app khởi động bình thường rồi hỏng lặng lẽ ở mọi route dùng client admin.
REQUIRED = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
)

# Biến công khai, đặt thẳng chứ không qua secret.
PLAIN: dict[str, str] = {
    "APP_ENV": "production",
    "APP_TIMEZONE": "Asia/Ho_Chi_Minh",
    "LOG_LEVEL": "info",
}

# Copy nguyên từ .env nếu có, dạng công khai.
PLAIN_FROM_ENV = (
    "ADMIN_EMAILS",
    "RECRUITER_EMAIL_DOMAINS",
    "GEMINI_MODEL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_FROM_EMAIL",
    "GOOGLE_CALENDAR_ID",
)


def run(cmd: list[str], *, dry_run: bool) -> None:
    """Chạy lệnh az. In tên lệnh chứ KHÔNG in tham số — chúng chứa khoá."""
    head = " ".join(cmd[:6])
    if dry_run:
        print(f"  [dry-run] {head} ... ({len(cmd)} tham số)")
        return
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # stderr của az có thể nhắc lại tên secret nhưng không in giá trị.
        print(f"\nLệnh thất bại: {head} ...", file=sys.stderr)
        print(result.stderr.strip()[:2000], file=sys.stderr)
        raise SystemExit(1)


def existing_secret_names(app: str, group: str) -> set[str]:
    result = subprocess.run(
        ["az", "containerapp", "secret", "list", "--name", app,
         "--resource-group", group, "--query", "[].name", "-o", "tsv"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return set()
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True, help="tên Container App")
    parser.add_argument("--resource-group", required=True)
    parser.add_argument(
        "--frontend-url",
        help="Domain frontend. Nhiều domain thì ngăn bằng dấu phẩy, ví dụ "
             "https://smartats.tech,https://app.vercel.app — TẤT CẢ vào "
             "CORS_ORIGINS, còn GOOGLE_REDIRECT_URI lấy domain ĐẦU TIÊN. "
             "Bỏ trống ở lần deploy đầu (chưa có domain) rồi chạy lại sau.",
    )
    parser.add_argument("--env-file", default=str(_ROOT / ".env"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.dry_run and shutil.which("az") is None:
        print("Không tìm thấy `az`. Cài Azure CLI: brew install azure-cli", file=sys.stderr)
        return 1

    env_path = Path(args.env_file)
    if not env_path.exists():
        print(f"Không thấy {env_path}", file=sys.stderr)
        return 1

    values = {k: (v or "").strip() for k, v in dotenv_values(env_path).items()}

    missing = [k for k in REQUIRED if not values.get(k)]
    if missing:
        print(f"Thiếu biến bắt buộc trong {env_path}: {', '.join(missing)}", file=sys.stderr)
        print("App sẽ không khởi động được nếu thiếu chúng.", file=sys.stderr)
        return 1

    # --- secret ---------------------------------------------------------
    present = {k: v for k, v in SECRETS.items() if values.get(k)}
    skipped = [k for k in SECRETS if not values.get(k)]

    secret_args: list[str] = [f"{name}={values[key]}" for key, name in present.items()]

    already = set() if args.dry_run else existing_secret_names(args.app, args.resource_group)
    if "jwt-secret" in already:
        print("  jwt-secret: đã có trên Container App — GIỮ NGUYÊN "
              "(sinh lại sẽ đăng xuất mọi phiên đang mở)")
    else:
        secret_args.append(f"jwt-secret={secrets.token_hex(32)}")
        print("  jwt-secret: sinh mới (không lấy từ .env, không in ra)")

    for key in present:
        print(f"  {key}: đặt")
    for key in skipped:
        print(f"  {key}: BỎ QUA — rỗng trong .env "
              f"(tính năng tương ứng sẽ tắt, xem docs/DEPLOY.md)")

    run(["az", "containerapp", "secret", "set", "--name", args.app,
         "--resource-group", args.resource_group, "--secrets", *secret_args],
        dry_run=args.dry_run)

    # --- biến môi trường -------------------------------------------------
    env_args = [f"{k}={v}" for k, v in PLAIN.items()]
    for key in PLAIN_FROM_ENV:
        if values.get(key):
            env_args.append(f"{key}={values[key]}")

    if args.frontend_url:
        urls = [u.strip().rstrip("/") for u in args.frontend_url.split(",") if u.strip()]
        # CORS_ORIGINS BẮT BUỘC: mặc định chỉ cho localhost:3000, và phần nới
        # lỏng cho localhost chỉ bật khi APP_ENV=development. Thiếu biến này là
        # trình duyệt chặn sạch mọi lời gọi từ Vercel.
        env_args.append("CORS_ORIGINS=" + ",".join(urls))
        # GOOGLE_REDIRECT_URI chỉ nhận MỘT giá trị: backend gửi đúng chuỗi này
        # khi đổi authorization code lấy token, và Google từ chối nếu nó lệch
        # dù chỉ một ký tự. Nên chọn domain chính, và luồng kết nối Google
        # Calendar sẽ chỉ chạy từ domain đó.
        env_args.append(f"GOOGLE_REDIRECT_URI={urls[0]}/schedule")
        print(f"\n  CORS_ORIGINS: {len(urls)} domain")
        print(f"  GOOGLE_REDIRECT_URI: {urls[0]}/schedule")
    else:
        print("\n  CORS_ORIGINS: CHƯA ĐẶT — frontend trên Vercel sẽ bị trình duyệt "
              "chặn cho tới khi bạn chạy lại script này kèm --frontend-url")

    env_args.append("JWT_SECRET=secretref:jwt-secret")
    for key, name in present.items():
        env_args.append(f"{key}=secretref:{name}")

    run(["az", "containerapp", "update", "--name", args.app,
         "--resource-group", args.resource_group, "--set-env-vars", *env_args],
        dry_run=args.dry_run)

    print("\nXong. Kiểm tra bằng:")
    print(f"  FQDN=$(az containerapp show --name {args.app} "
          f"--resource-group {args.resource_group} "
          "--query properties.configuration.ingress.fqdn -o tsv)")
    print('  curl -s "https://$FQDN/health"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
