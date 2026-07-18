from __future__ import annotations

import asyncio
import sys
from sqlalchemy import select

from src.backend.app.models import Requirement, RequirementAnalysis, RequirementEmbedding, Resume, ResumeAnalysis, ResumeEmbedding, User
from src.backend.app.repositories.requirement_analysis_repository import RequirementAnalysisRepository
from src.backend.app.repositories.requirement_embedding_repository import RequirementEmbeddingRepository
from src.backend.app.repositories.requirement_repository import RequirementRepository
from src.backend.app.repositories.resume_analysis_repository import ResumeAnalysisRepository
from src.backend.app.repositories.resume_embedding_repository import ResumeEmbeddingRepository
from src.backend.app.repositories.resume_repository import ResumeRepository
from src.backend.app.repositories.user_repository import UserRepository
from tests.common_07 import async_session_factory


async def check_fk_counts(session, parent_model, child_model, parent_key: str, child_key: str) -> int:
    parent_rows = (await session.execute(select(parent_model))).scalars().all()
    child_rows = (await session.execute(select(child_model))).scalars().all()
    parent_ids = {getattr(row, parent_key) for row in parent_rows}
    missing = [row for row in child_rows if getattr(row, child_key) not in parent_ids]
    return len(missing)


async def main() -> None:
    async with async_session_factory() as session:
        users = (await session.execute(select(User))).scalars().all()
        resumes = (await session.execute(select(Resume))).scalars().all()
        resume_analyses = (await session.execute(select(ResumeAnalysis))).scalars().all()
        resume_embeddings = (await session.execute(select(ResumeEmbedding))).scalars().all()
        requirements = (await session.execute(select(Requirement))).scalars().all()
        requirement_analyses = (await session.execute(select(RequirementAnalysis))).scalars().all()
        requirement_embeddings = (await session.execute(select(RequirementEmbedding))).scalars().all()

        print(f"Users: {len(users)}")
        print(f"Resumes: {len(resumes)}")
        print(f"ResumeAnalysis: {len(resume_analyses)}")
        print(f"ResumeEmbedding: {len(resume_embeddings)}")
        print(f"Requirements: {len(requirements)}")
        print(f"RequirementAnalysis: {len(requirement_analyses)}")
        print(f"RequirementEmbedding: {len(requirement_embeddings)}")

        checks = [
            ("resume.user_id -> users.id", await check_fk_counts(session, User, Resume, "id", "user_id")),
            ("requirement.user_id -> users.id", await check_fk_counts(session, User, Requirement, "id", "user_id")),
            ("resume_analysis.resume_id -> resumes.id", await check_fk_counts(session, Resume, ResumeAnalysis, "id", "resume_id")),
            ("resume_embedding.resume_id -> resumes.id", await check_fk_counts(session, Resume, ResumeEmbedding, "id", "resume_id")),
            ("requirement_analysis.requirement_id -> requirements.id", await check_fk_counts(session, Requirement, RequirementAnalysis, "id", "requirement_id")),
            ("requirement_embedding.requirement_id -> requirements.id", await check_fk_counts(session, Requirement, RequirementEmbedding, "id", "requirement_id")),
        ]

        for label, missing_count in checks:
            status = "OK" if missing_count == 0 else f"BROKEN ({missing_count} missing)"
            print(f"{label}: {status}")


if __name__ == "__main__":
    if sys.platform == 'win32':
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
    else:
        asyncio.run(main())
