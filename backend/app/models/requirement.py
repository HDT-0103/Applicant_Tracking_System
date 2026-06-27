import uuid
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, Text  # Import Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base

if TYPE_CHECKING:
    from models.user import User
    from models.requirement_embedding import RequirementEmbedding

class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[Optional[str]] = mapped_column(String(255))
    
    # NÊN SỬA: Dùng Text
    description: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    
    skills: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="requirements")
    embeddings: Mapped[List["RequirementEmbedding"]] = relationship(back_populates="requirement", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Requirement id={self.id} position={self.position}>"