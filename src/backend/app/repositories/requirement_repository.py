import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.requirement import Requirement

class RequirementRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_requirement(self, user_id: uuid.UUID, position: str, description: str, skills: List[str]) -> Requirement:
        requirement = Requirement(user_id=user_id, position=position, description=description, skills=skills)
        self.session.add(requirement)
        return requirement

    async def get_all_requirements(self, skip: int = 0, limit: int = 10) -> List[Requirement]:
        statement = select(Requirement).offset(skip).limit(limit)
        result = await self.session.scalars(statement)
        return result.all()