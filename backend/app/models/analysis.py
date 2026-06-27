import uuid
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base

if TYPE_CHECKING:
    from models.resume import Resume

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # NÊN SỬA: model_name chuyển sang NOT NULL cực kỳ quan trọng
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # NÊN SỬA: Chuyển toàn bộ các trường dài sang Text
    summary: Mapped[Optional[str]] = mapped_column(Text)
    strength: Mapped[Optional[str]] = mapped_column(Text)
    weakness: Mapped[Optional[str]] = mapped_column(Text)
    
    skills: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    resume: Mapped["Resume"] = relationship(back_populates="analyses")

    def __repr__(self) -> str:
        return f"<Analysis id={self.id} model={self.model_name}>"