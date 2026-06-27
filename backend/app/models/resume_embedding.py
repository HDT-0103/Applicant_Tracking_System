import uuid
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy import TYPES
    Vector = TYPES.UserDefinedType

if TYPE_CHECKING:
    from models.resume import Resume

class ResumeEmbedding(Base):
    __tablename__ = "resume_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Chia 3 vector và set kích thước 768 cho model E5
    summary_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768))
    skills_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768))
    experience_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768))
    
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    __table_args__ = (
        UniqueConstraint("resume_id", "model_name", name="uq_resume_model_embedding"),
    )

    resume: Mapped["Resume"] = relationship(back_populates="embeddings")

    def __repr__(self) -> str:
        return f"<ResumeEmbedding id={self.id} model={self.model_name}>"