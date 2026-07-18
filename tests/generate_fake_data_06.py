from __future__ import annotations

import asyncio
import sys
from faker import Faker

from src.backend.app.models.enums import RoleType
from src.backend.app.repositories.requirement_repository import RequirementRepository
from src.backend.app.repositories.user_repository import UserRepository
from tests.common_07 import async_session_factory

fake = Faker()


async def main() -> None:
    async with async_session_factory() as session:
        user_repo = UserRepository(session)
        requirement_repo = RequirementRepository(session)

        async with session.begin():
            recruiter = await user_repo.create_user(
                name=fake.name(),
                email=fake.unique.email(),
                role=RoleType.RECRUITER.value,
            )
            print(f"Fake recruiter: {recruiter.id}")

            for _ in range(3):
                candidate = await user_repo.create_user(
                    name=fake.name(),
                    email=fake.unique.email(),
                    role=RoleType.CANDIDATE.value,
                )
                print(f"Fake user: {candidate.id}")

            for _ in range(3):
                requirement = await requirement_repo.create_requirement(
                    user_id=recruiter.id,
                    position=fake.job(),
                    desrciption=fake.text(max_nb_chars=1000),
                    skills=[fake.job(), fake.bs(), fake.catch_phrase()],
                )
                print(f"Fake requirement: {requirement.id}")

        await session.commit()


if __name__ == "__main__":
    if sys.platform == 'win32':
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
    else:
        asyncio.run(main())
