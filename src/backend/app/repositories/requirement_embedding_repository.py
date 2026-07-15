import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.requirement_embedding import RequirementEmbedding

class RequirementEmbeddingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_requirement_and_model(self, requirement_id: uuid.UUID, model_name: str) -> Optional[RequirementEmbedding]:
        statement = select(RequirementEmbedding).where(
            RequirementEmbedding.requirement_id == requirement_id,
            RequirementEmbedding.model_name == model_name
        )
        return await self.session.scalar(statement)