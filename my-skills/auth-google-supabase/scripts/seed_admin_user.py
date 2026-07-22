#!/usr/bin/env python3
"""
Seed an admin user into Supabase for testing Google OAuth login.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).parent.parent.parent.parent / "src" / "backend"
sys.path.insert(0, str(backend_path))

from modules.shared.infrastructure.config import get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client


def seed_admin(email: str, name: str):
    settings = get_settings()
    supabase = get_supabase_client(settings, use_admin=True)
    data = {
        "email": email,
        "name": name,
        "role": "admin",
        "is_active": True,
    }
    result = supabase.table("users").upsert(data, on_conflict="email").execute()
    print(f"Seeded admin user: {email} — {result.data}")


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@example.com"
    name = sys.argv[2] if len(sys.argv) > 2 else "Admin User"
    seed_admin(email, name)
