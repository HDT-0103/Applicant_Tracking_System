from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.backend.app.models.base import Base
from src.backend.app.models.enums import JobEmbeddingSource

try:
    from pgvector.sqlalchemy import Vector
except ImportError:  # pragma: no cover - fallback for environments without pgvector installed
    from sqlalchemy.types import UserDefinedType

    class Vector(UserDefinedType):
        def __init__(self, dimensions: int):
            self.dimensions = dimensions


if TYPE_CHECKING:
    from src.backend.app.models.job_posting import JobPosting


class JobEmbedding(Base):
    __tablename__ = "job_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs_posting.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_type: Mapped[JobEmbeddingSource] = mapped_column(
        SQLEnum(JobEmbeddingSource, native_enum=True),
        nullable=False,
    )
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    job_posting: Mapped["JobPosting"] = relationship(back_populates="embeddings")
