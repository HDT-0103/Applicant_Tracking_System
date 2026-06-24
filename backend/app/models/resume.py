import uuid
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, Text  # Import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base

if TYPE_CHECKING:
    from models.user import User
    from models.resume_embedding import ResumeEmbedding
    from models.analysis import Analysis

class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # NÊN SỬA: Đổi String sang Text hoàn toàn cho các trường dài
    raw_text: Mapped[Optional[str]] = mapped_column(Text) 
    file_path: Mapped[Optional[str]] = mapped_column(String(512))
    
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"), onupdate=text("now()"))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="resumes")
    embeddings: Mapped[List["ResumeEmbedding"]] = relationship(back_populates="resume", cascade="all, delete-orphan")
    analyses: Mapped[List["Analysis"]] = relationship(back_populates="resume", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Resume {self.id}>"