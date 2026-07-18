import uuid
from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from src.backend.app.models.resume_analysis import ResumeAnalysis

class ResumeAnalysisRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_resume_id(self, resume_id: uuid.UUID) -> List[ResumeAnalysis]:
        statement = select(ResumeAnalysis).where(ResumeAnalysis.resume_id == resume_id)
        result = await self.session.scalars(statement)
        return result.all()

    async def get_latest_analysis(self, resume_id: uuid.UUID) -> Optional[ResumeAnalysis]:
        """Lấy kết quả phân tích mới nhất từ AI cho CV này"""
        statement = (
            select(ResumeAnalysis)
            .where(ResumeAnalysis.resume_id == resume_id)
            .order_by(desc(ResumeAnalysis.created_at))  # Sắp xếp mới nhất lên đầu
            .limit(1)
        )
        return await self.session.scalar(statement)