from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, Integer
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base import Base

class ApiRateLimit(Base):
    __tablename__ = "api_rate_limits"

    provider: Mapped[str] = mapped_column(String(50), primary_key=True)
    rate_limit_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_limit_remaining: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_limit_reset: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()")
    )

    def __repr__(self) -> str:
        return f"<ApiRateLimit {self.provider} remaining={self.rate_limit_remaining}>"
