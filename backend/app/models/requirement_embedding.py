import uuid
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy import TYPES
    Vector = TYPES.UserDefinedType

if TYPE_CHECKING:
    from models.requirement import Requirement

class RequirementEmbedding(Base):
    __tablename__ = "requirement_embeddings"

    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_id: Mapped[int] = mapped_column(
        ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1024))
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    # NÊN SỬA: UniqueConstraint tránh nhân bản bản ghi embedding cùng model
    __table_args__ = (
        UniqueConstraint("requirement_id", "model_name", name="uq_requirement_model_embedding"),
    )

    requirement: Mapped["Requirement"] = relationship(back_populates="embeddings")

    def __repr__(self) -> str:
        return f"<RequirementEmbedding id={self.id} model={self.model_name}>"