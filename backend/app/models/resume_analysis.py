import uuid
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base

if TYPE_CHECKING:
    from models.resume import Resume

class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    summary: Mapped[Optional[str]] = mapped_column(Text)
    # Đổi thành mảng (ARRAY) theo thiết kế
    strengths: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    weaknesses: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    skills: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    
    # Dùng JSONB cho timeline kinh nghiệm
    experience: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    resume: Mapped["Resume"] = relationship(back_populates="analyses")

    def __repr__(self) -> str:
        return f"<ResumeAnalysis id={self.id} model={self.model_name}>"