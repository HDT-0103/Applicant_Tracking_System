import uuid
from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.requirement_analysis import RequirementAnalysis

class RequirementAnalysisRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_requirement_id(self, requirement_id: uuid.UUID) -> List[RequirementAnalysis]:
        statement = select(RequirementAnalysis).where(RequirementAnalysis.requirement_id == requirement_id)
        result = await self.session.scalars(statement)
        return result.all()

    async def get_latest_analysis(self, requirement_id: uuid.UUID) -> Optional[RequirementAnalysis]:
        """Lấy kết quả phân tích JD mới nhất từ AI"""
        statement = (
            select(RequirementAnalysis)
            .where(RequirementAnalysis.requirement_id == requirement_id)
            .order_by(desc(RequirementAnalysis.created_at))
            .limit(1)
        )
        return await self.session.scalar(statement)