import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        # Dùng await với session.get
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> Optional[User]:
        statement = select(User).where(User.email == email)
        # Dùng await với session.scalar
        return await self.session.scalar(statement)

    async def create_user(self, name: str, email: str, role) -> User:
        new_record = User(name=name, email=email, role=role)
        self.session.add(new_record)  # Thao tác sync, không cần await
        return new_record