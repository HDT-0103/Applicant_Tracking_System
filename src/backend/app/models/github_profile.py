from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy import Integer, String, Text, ForeignKey, text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.backend.app.models.base import Base

class GitHubProfile(Base):
    __tablename__ = "github_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # Đảm bảo dùng String vì schema là character varying
    candidate_uuid: Mapped[str] = mapped_column(
        String,
        ForeignKey("candidates.uuid", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    public_repos_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    
    top_languages: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    
    readme_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    repos: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    
    # Relationship với Candidate (Nếu project bạn có setup Mapped cho Candidate, bạn có thể uncomment)
    # candidate: Mapped["Candidate"] = relationship(back_populates="github_profile")