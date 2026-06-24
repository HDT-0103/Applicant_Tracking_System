import uuid
from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from models.analysis import Analysis

class AnalysisRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_resume_id(self, resume_id: uuid.UUID) -> List[Analysis]:
        statement = select(Analysis).where(Analysis.resume_id == resume_id)
        result = await self.session.scalars(statement)
        return result.all()

    async def get_latest_analysis(self, resume_id: uuid.UUID) -> Optional[Analysis]:
        """Pattern Production: Lấy kết quả phân tích mới nhất từ AI cho CV này"""
        statement = (
            select(Analysis)
            .where(Analysis.resume_id == resume_id)
            .order_by(desc(Analysis.created_at))  # Sắp xếp mới nhất lên đầu
            .limit(1)
        )
        return await self.session.scalar(statement)