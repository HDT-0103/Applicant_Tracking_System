from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.backend.app.models.base import Base
from src.backend.app.models.enums import CandidateStatus

if TYPE_CHECKING:
    from src.backend.app.models.enrichment_profile import EnrichmentProfile
    from src.backend.app.models.resume import Resume


class Candidate(Base):
    __tablename__ = "candidates"

    uuid: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    github_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    current_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    university: Mapped[str | None] = mapped_column(String(255), nullable=True)
    education_level: Mapped[str | None] = mapped_column(String(255), nullable=True)
    salary_expectation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CandidateStatus] = mapped_column(
        SQLEnum(CandidateStatus, native_enum=True),
        nullable=False,
        default=CandidateStatus.ACTIVE,
    )
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

    resumes: Mapped[list[Resume]] = relationship(
        back_populates="candidate",
        cascade="all, delete-orphan",
    )
    enrichment_profile: Mapped[EnrichmentProfile | None] = relationship(
        back_populates="candidate",
        uselist=False,
        cascade="all, delete-orphan",
    )
