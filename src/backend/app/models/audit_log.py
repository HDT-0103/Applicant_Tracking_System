import uuid
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from backend.app.models.base import Base

if TYPE_CHECKING:
    from backend.app.models.user import User


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    candidate_uuid: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()")
    )

    # Relationship
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<AuditLog user_id={self.user_id} action={self.action}>"
