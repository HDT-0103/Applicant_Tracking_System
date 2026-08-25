from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SQLEnum, Float, ForeignKey, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.backend.app.models.base import Base
from src.backend.app.models.enums import EnrichmentStatus

if TYPE_CHECKING:
    from src.backend.app.models.candidate import Candidate


class EnrichmentProfile(Base):
    __tablename__ = "enrichment_profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    candidate_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.uuid", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    enrichment_status: Mapped[EnrichmentStatus] = mapped_column(
        SQLEnum(EnrichmentStatus, native_enum=True),
        nullable=False,
        default=EnrichmentStatus.QUEUED,
    )
    skills: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    # `github` / `linkedin` từng nằm ở đây nhưng đã chuyển sang
    # `candidates.github_url` / `candidates.linkedin_url` khi schema được chuẩn
    # hoá — link là thuộc tính của ứng viên, không phải của một lượt enrich.
    # Giữ lại ở đây khiến mọi lượt ghi có link đều lỗi PGRST204.
    semantic_tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    skill_matrix: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    match_confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_increase: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    candidate: Mapped[Candidate] = relationship(back_populates="enrichment_profile")