from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.backend.app.models.base import Base
from src.backend.app.models.enums import EmbeddingSource

try:
    from pgvector.sqlalchemy import Vector
except ImportError:  # pragma: no cover - fallback for environments without pgvector installed
    from sqlalchemy.types import UserDefinedType

    class Vector(UserDefinedType):
        def __init__(self, dimensions: int):
            self.dimensions = dimensions


if TYPE_CHECKING:
    from src.backend.app.models.enrichment_profile import EnrichmentProfile


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    enrichment_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("enrichment_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_type: Mapped[EmbeddingSource] = mapped_column(
        SQLEnum(EmbeddingSource, native_enum=True),
        nullable=False,
    )
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(768), nullable=False)
    model_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="intfloat/multilingual-e5-base",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    enrichment_profile: Mapped[EnrichmentProfile] = relationship()


ResumeEmbedding = Embedding

