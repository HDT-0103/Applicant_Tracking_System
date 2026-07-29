import uuid
from typing import List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, text, TIMESTAMP, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID  # Import UUID từ postgresql dialect
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base
from backend.app.models.enums import RoleType

if TYPE_CHECKING:
    from models.resume import Resume
    from models.requirement import Requirement
    from models.meeting import Meeting

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
    
    # native_enum=True dùng type role_type có sẵn trong Postgres.
    # values_callable bắt buộc phải có: mặc định SQLAlchemy lưu .name (VD "ADMIN"),
    # nhưng enum trong DB dùng .value chữ thường ("admin") -> phải map sang .value.
    role: Mapped[RoleType] = mapped_column(
        Enum(
            RoleType,
            name="role_type",
            native_enum=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Trạng thái phê duyệt tài khoản. User đăng ký công khai (HR) được set giá trị
    # trong AuthService; role admin chỉ tồn tại qua seed/Admin Dashboard (Epic 6).
    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false")
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), 
        server_default=text("now()")
    )

    # Relationships
    resumes: Mapped[List["Resume"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    requirements: Mapped[List["Requirement"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    
    # Sửa cú pháp foreign_keys dạng chuỗi chuẩn khi tách file
    hosted_meetings: Mapped[List["Meeting"]] = relationship(
        back_populates="host", 
        foreign_keys="Meeting.host_id"
    )
    participated_meetings: Mapped[List["Meeting"]] = relationship(
        back_populates="participant", 
        foreign_keys="Meeting.participant_id"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"