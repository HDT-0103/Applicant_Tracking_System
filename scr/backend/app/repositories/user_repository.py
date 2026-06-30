import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.user import User

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> Optional[User]:
        statement = select(User).where(User.email == email)
        return await self.session.scalar(statement)

    async def create_user(self, name: str, email: str, role) -> User:
        new_record = User(name=name, email=email, role=role)
        self.session.add(new_record)
        # NÊN THÊM: flush() để DB sinh ID và kiểm tra ràng buộc (như unique email) ngay lập tức
        # mà không cần phải đợi commit toàn bộ transaction.
        await self.session.flush()
        # NÊN THÊM: refresh() nếu bạn muốn object được cập nhật các giá trị 
        # default từ phía server (ví dụ: id hoặc created_at)
        await self.session.refresh(new_record)
        return new_record