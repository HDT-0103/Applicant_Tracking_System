from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.backend.app.models.base import Base

if TYPE_CHECKING:
    from src.backend.app.models.application import Application
    from src.backend.app.models.job_embedding import JobEmbedding


class JobPosting(Base):
    __tablename__ = "jobs_posting"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seniority_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    work_mode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_openings: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    must_have_skills: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
    )
    nice_to_have_skills: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_responsibilities: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    nice_to_have_qualifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
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

    embeddings: Mapped[list["JobEmbedding"]] = relationship(
        back_populates="job_posting",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list["Application"]] = relationship(
        back_populates="job_posting",
        cascade="all, delete-orphan",
    )
