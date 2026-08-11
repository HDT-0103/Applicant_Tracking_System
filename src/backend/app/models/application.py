from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Float, ForeignKey, text, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

# IMPORTANT ASSUMPTION: 
# Import Vector type từ thư viện project bạn đang dùng (thường là pgvector).
# Nếu project dùng pgvector, hãy dùng dòng này. Nếu nó được định nghĩa ở model khác (ví dụ models.embeddings), 
# hãy thay thế bằng import tương ứng của project.
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy.types import UserDefinedType
    class Vector(UserDefinedType):
        def get_col_spec(self): return "VECTOR"

from src.backend.app.models.base import Base

if TYPE_CHECKING:
    from src.backend.app.models.job_posting import JobPosting
    from src.backend.app.models.resume import Resume


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # [FIXED]: candidate_uuid is character varying in DB Schema
    candidate_uuid: Mapped[str] = mapped_column(
        String,
        ForeignKey("candidates.uuid", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    job_posting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs_posting.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    summary_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    experience_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    github_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # [NEW]: Match retrieved GitHub context
    github_project: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_embedding: Mapped[Any | None] = mapped_column(Vector, nullable=True) # Điều chỉnh Vector params nếu codebase yêu cầu (VD: Vector(1536))

    job_posting: Mapped["JobPosting"] = relationship(
        back_populates="applications"
    )

    resume: Mapped["Resume"] = relationship()