from __future__ import annotations

import asyncio
import sys
from src.backend.app.models import Requirement, RequirementAnalysis, RequirementEmbedding
from src.backend.app.models.enums import RoleType
from src.backend.app.repositories.requirement_analysis_repository import RequirementAnalysisRepository
from src.backend.app.repositories.requirement_embedding_repository import RequirementEmbeddingRepository
from src.backend.app.repositories.requirement_repository import RequirementRepository
from src.backend.app.repositories.user_repository import UserRepository
from src.backend.app.services.embedding_service import EmbeddingService
from src.backend.app.services.llm_provider import GroqProvider
from src.backend.app.services.llm_service import LLMService
from tests.common_07 import async_session_factory

DEFAULT_MODEL_NAME = "intfloat/multilingual-e5-base"


async def ensure_recruiter(session):
    user_repo = UserRepository(session)
    existing = await user_repo.get_by_email("recruiter.pipeline@example.com")
    if existing is not None:
        return existing
    async with session.begin():
        return await user_repo.create_user(
            name="Pipeline Recruiter",
            email="recruiter.pipeline@example.com",
            role=RoleType.RECRUITER.value,
        )


async def main() -> None:
    requirement_text = """
    Senior Python Backend Engineer.
    Skills: Python, FastAPI, SQLAlchemy, PostgreSQL, pgvector.
    Experience: 3+ years in backend systems, async APIs, and database persistence.
    """.strip()

    llm = LLMService(provider=GroqProvider())
    embedding_service = EmbeddingService()

    async with async_session_factory() as session:
        recruiter = await ensure_recruiter(session)
        requirement_repo = RequirementRepository(session)
        analysis_repo = RequirementAnalysisRepository(session)
        embedding_repo = RequirementEmbeddingRepository(session)

        analysis = llm.analyze_requirement(requirement_text)
        if not hasattr(analysis, "summary"):
            raise AttributeError("LLMService did not return a RequirementAnalysis-compatible object.")

        requirement_analysis = analysis
        embeddings = embedding_service.embed_requirement(requirement_analysis)

        if isinstance(embeddings, dict):
            summary_embedding = embeddings["summary_embedding"]
            skills_embedding = embeddings["skills_embedding"]
            experience_embedding = embeddings["experience_embedding"]
            model_name = embeddings.get("model_name", DEFAULT_MODEL_NAME)
        else:
            summary_embedding = embeddings.summary_embedding
            skills_embedding = embeddings.skills_embedding
            experience_embedding = embeddings.experience_embedding
            model_name = getattr(embedding_service, "model_name", DEFAULT_MODEL_NAME)

        async with session.begin():
            requirement = await requirement_repo.create_requirement(
                user_id=recruiter.id,
                position="Senior Python Backend Engineer",
                desrciption=requirement_text,
                skills=requirement_analysis.skills,
            )
            await session.flush()

            analysis_record = RequirementAnalysis(
                requirement_id=requirement.id,
                model_name=getattr(llm.provider, "model", "llm-model"),
                summary=requirement_analysis.summary,
                skills=requirement_analysis.skills,
                experience="; ".join(requirement_analysis.experience),
            )
            session.add(analysis_record)

            embedding_record = RequirementEmbedding(
                requirement_id=requirement.id,
                model_name=model_name,
                summary_embedding=summary_embedding,
                skills_embedding=skills_embedding,
                experience_embedding=experience_embedding,
            )
            session.add(embedding_record)

        print(f"Requirement ID: {requirement.id}")
        await session.commit()


if __name__ == "__main__":
    if sys.platform == 'win32':
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
    else:
        asyncio.run(main())
