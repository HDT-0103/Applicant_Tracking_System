from __future__ import annotations

import asyncio
import uuid
import sys
from sqlalchemy import select

from src.backend.app.models import User
from src.backend.app.models.enums import RoleType
from src.backend.app.repositories.user_repository import UserRepository

from tests.common_07 import async_session_factory, logger

SEED_USERS = [
    ("Candidate Alpha", f"candidate.alpha.{uuid.uuid4().hex[:8]}@example.com", RoleType.CANDIDATE),
    ("Candidate Beta", f"candidate.beta.{uuid.uuid4().hex[:8]}@example.com", RoleType.CANDIDATE),
    ("Recruiter One", f"recruiter.one.{uuid.uuid4().hex[:8]}@example.com", RoleType.RECRUITER),
]


async def main() -> None:
    async with async_session_factory() as session:
        repo = UserRepository(session)
        inserted_ids: list[str] = []

        async with session.begin():
            for name, email, role in SEED_USERS:
                existing = await repo.get_by_email(email)
                if existing is not None:
                    inserted_ids.append(str(existing.id))
                    logger.info("Reused user %s -> %s", email, existing.id)
                    continue
                
                print(f"DEBUG: Role being sent is: '{RoleType.CANDIDATE.value}'")
                user = await repo.create_user(name=name, email=email, role=role)
                inserted_ids.append(str(user.id))
                logger.info("Inserted user %s -> %s", email, user.id)

        result = await session.execute(select(User).where(User.id.in_(inserted_ids)))
        print("Inserted UUIDs:")
        for user in result.scalars().all():
            print(user.id)


if __name__ == "__main__":
    if sys.platform == 'win32':
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
    else:
        asyncio.run(main())
