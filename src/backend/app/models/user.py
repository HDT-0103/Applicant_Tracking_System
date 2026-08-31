import uuid
from datetime import datetime

from sqlalchemy import Enum, String, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.backend.app.models.base import Base
from src.backend.app.models.enums import RoleType

class User(Base):
    __tablename__ = "users"

    # Viết rõ UUID(as_uuid=True) theo chuẩn Production
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True, 
        server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    
    # MUST FIX: Bắt buộc truyền Enum(RoleType, native_enum=True)
    role: Mapped[RoleType] = mapped_column(
    Enum(RoleType, native_enum=True, values_callable=lambda obj: [e.value for e in obj]),
    nullable=False
    )
    
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), 
        server_default=text("now()")
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"