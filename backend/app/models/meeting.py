import uuid
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from enums import StatusType

if TYPE_CHECKING:
    from models.user import User

class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    
    # MUST FIX: Áp dụng Native Enum
    status: Mapped[StatusType] = mapped_column(
        Enum(StatusType, native_enum=True), 
        nullable=False, 
        server_default=text("'waiting'")
    )
    meeting_link: Mapped[Optional[str]] = mapped_column(String(512))
    
    host_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    # Sửa cú pháp foreign_keys truyền trực tiếp biến đối tượng (hoặc text không bọc ngoặc vuông sai cách)
    host: Mapped["User"] = relationship(back_populates="hosted_meetings", foreign_keys=[host_id])
    participant: Mapped["User"] = relationship(back_populates="participated_meetings", foreign_keys=[participant_id])

    def __repr__(self) -> str:
        return f"<Meeting id={self.id} status={self.status}>"