import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.resume import Resume
from backend.app.models.resume_analysis import ResumeAnalysis
from backend.app.models.resume_embedding import ResumeEmbedding

class ResumeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_resume(self, user_id: uuid.UUID, raw_text: str, file_path: str) -> Resume:
        new_resume = Resume(user_id=user_id, raw_text=raw_text, file_path=file_path)
        self.session.add(new_resume)
        return new_resume

    async def get_by_id(self, resume_id: uuid.UUID) -> Optional[Resume]:
        return await self.session.get(Resume, resume_id)

    async def get_by_user_id(self, user_id: uuid.UUID) -> List[Resume]:
        statement = select(Resume).where(Resume.user_id == user_id)
        result = await self.session.scalars(statement)
        return result.all()

    async def get_resume_with_all_data(self, resume_id: uuid.UUID) -> Optional[Resume]:
        """Lấy CV kèm theo cả kết quả phân tích AI và Vector Embedding (Giải quyết triệt để N+1 query)"""
        statement = (
            select(Resume)
            .where(Resume.id == resume_id)
            .options(
                selectinload(Resume.analyses),
                selectinload(Resume.embeddings)
            )
        )
        return await self.session.scalar(statement)
    
    async def get_all_with_embeddings(self) -> List[tuple]:
        """
        Query lấy tất cả Resume kèm theo Embedding và Analysis tương ứng.
        Trả về danh sách các tuple (Embedding, Analysis)
        """
        stmt = (
            select(ResumeEmbedding, ResumeAnalysis)
            .join(ResumeAnalysis, ResumeEmbedding.resume_id == ResumeAnalysis.resume_id)
        )
        result = await self.session.execute(stmt)
        return result.all()