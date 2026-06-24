import uuid
from typing import List
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from models.meeting import Meeting

class MeetingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_meetings_for_user(self, user_id: uuid.UUID) -> List[Meeting]:
        statement = select(Meeting).where(
            or_(Meeting.host_id == user_id, Meeting.participant_id == user_id)
        )
        result = await self.session.scalars(statement)
        return result.all()