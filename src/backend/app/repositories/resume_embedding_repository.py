import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.resume_embedding import ResumeEmbedding

class ResumeEmbeddingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_resume_and_model(self, resume_id: uuid.UUID, model_name: str) -> Optional[ResumeEmbedding]:
        """
        Kiểm tra xem CV này đã được chạy embedding bằng model này chưa.
        Hàm này cực kỳ quan trọng để tránh chèn trùng gây lỗi UniqueConstraint.
        """
        statement = select(ResumeEmbedding).where(
            ResumeEmbedding.resume_id == resume_id,
            ResumeEmbedding.model_name == model_name
        )
        return await self.session.scalar(statement)