"""Seed (or update) a System Admin account directly in the database.

Idempotent: chạy nhiều lần vẫn an toàn — nếu email đã tồn tại thì cập nhật lại
role=admin, is_approved=TRUE và (tùy chọn) đặt lại mật khẩu.

Cách chạy (từ thư mục gốc project):
    ./venv/bin/python src/backend/scripts/seed_admin.py

Tuỳ biến qua biến môi trường (không bắt buộc):
    ADMIN_SEED_EMAIL     (mặc định: admin@smartats.com)
    ADMIN_SEED_PASSWORD  (mặc định: Admin@123  -> ĐỔI NGAY sau khi đăng nhập)
    ADMIN_SEED_NAME      (mặc định: System Admin)
"""
import asyncio
import os
import sys
from pathlib import Path

# Cho phép chạy standalone: nạp 'src' và 'src/backend' vào path giống lúc app khởi động.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "backend"))

from backend.app.database.connection import async_session_factory  # noqa: E402
from backend.app.models.enums import RoleType  # noqa: E402
from backend.app.models.user import User  # noqa: E402
from modules.auth.infra.password_service import PasswordService  # noqa: E402
from sqlalchemy import select  # noqa: E402

ADMIN_EMAIL = os.environ.get("ADMIN_SEED_EMAIL", "admin@smartats.com").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_SEED_PASSWORD", "Admin@123")
ADMIN_NAME = os.environ.get("ADMIN_SEED_NAME", "System Admin")


async def seed_admin() -> None:
    async with async_session_factory() as session:
        existing = await session.scalar(select(User).where(User.email == ADMIN_EMAIL))

        if existing:
            existing.role = RoleType.ADMIN
            existing.is_approved = True
            existing.password_hash = PasswordService.hash_password(ADMIN_PASSWORD)
            action = "UPDATED"
        else:
            session.add(
                User(
                    name=ADMIN_NAME,
                    email=ADMIN_EMAIL,
                    role=RoleType.ADMIN,
                    is_approved=True,
                    password_hash=PasswordService.hash_password(ADMIN_PASSWORD),
                )
            )
            action = "CREATED"

        await session.commit()

    print("=" * 56)
    print(f"[+] Admin account {action}")
    print(f"    Email    : {ADMIN_EMAIL}")
    print(f"    Password : {ADMIN_PASSWORD}")
    print(f"    Role     : admin (is_approved=TRUE)")
    print("    >> Đăng nhập tại /login rồi ĐỔI MẬT KHẨU ngay.")
    print("=" * 56)


if __name__ == "__main__":
    asyncio.run(seed_admin())
