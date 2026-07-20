import uuid
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base import Base

class AbacPolicy(Base):
    __tablename__ = "abac_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_masked: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    masking_pattern: Mapped[str] = mapped_column(String(50), default="***", server_default=text("'***'"))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()")
    )

    def __repr__(self) -> str:
        return f"<AbacPolicy {self.role} -> {self.resource}.{self.field_name} (masked: {self.is_masked})>"
