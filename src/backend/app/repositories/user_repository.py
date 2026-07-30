from __future__ import annotations

from typing import Optional
import uuid

from src.backend.app.models.enums import RoleType
from src.backend.app.models.user import User
from src.backend.app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    @staticmethod
    def _to_user(row: dict | None) -> User | None:
        if not row:
            return None
        return User(**row)

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        response = (
            self.client.table("users")
            .select("*")
            .eq("id", str(user_id))
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_user(row)

    async def get_by_email(self, email: str) -> Optional[User]:
        response = (
            self.client.table("users")
            .select("*")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_user(row)

    async def create_user(self, name: str, email: str, role: RoleType) -> User:
        response = (
            self.client.table("users")
            .insert({"name": name, "email": email, "role": role.value})
            .select("*")
            .execute()
        )
        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError("Failed to create user record.")
        return User(**row)