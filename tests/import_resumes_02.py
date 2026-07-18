from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from src.backend.app.models import Resume, ResumeAnalysis, ResumeEmbedding, User
from src.backend.app.repositories.resume_analysis_repository import ResumeAnalysisRepository
from src.backend.app.repositories.resume_embedding_repository import ResumeEmbeddingRepository
from src.backend.app.repositories.resume_repository import ResumeRepository
from src.backend.app.repositories.user_repository import UserRepository
from src.backend.app.services.embedding_service import EmbeddingService
from src.backend.app.services.llm_provider import GroqProvider
from src.backend.app.services.llm_service import LLMService
from src.backend.app.services.parser_service import ParserService
from tests.common_07 import async_session_factory, logger, sample_resumes_dir

DEFAULT_MODEL_NAME = "intfloat/multilingual-e5-base"


def pick_user_email_prefix(name: str) -> str:
    return name.split("@")[0]


async def ensure_candidate_user(session) -> User:
    repo = UserRepository(session)
    existing = await repo.get_by_email("candidate.pipeline@example.com")
    if existing is not None:
        return existing
    async with session.begin():
        return await repo.create_user(
            name="Pipeline Candidate",
            email="candidate.pipeline@example.com",
            role=__import__("src.backend.app.models.enums", fromlist=["RoleType"]).RoleType.CANDIDATE.value,
        )


async def main() -> None:
    resumes_path = sample_resumes_dir()
    if not resumes_path.exists():
        raise FileNotFoundError(f"Missing folder: {resumes_path}")

    pdf_files = sorted(resumes_path.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {resumes_path}")
        return

    parser = ParserService()
    llm = LLMService(provider=GroqProvider())
    embedding_service = EmbeddingService()

    async with async_session_factory() as session:
        resume_repo = ResumeRepository(session)
        analysis_repo = ResumeAnalysisRepository(session)
        embedding_repo = ResumeEmbeddingRepository(session)
        candidate = await ensure_candidate_user(session)

        for pdf_file in pdf_files:
            print(f"Processing {pdf_file.name}")
            parsed_text = parser.process(str(pdf_file))
            llm_result = llm.analyze_resume(parsed_text)

            if not hasattr(llm_result, "summary"):
                raise AttributeError("LLMService did not return a ResumeAnalysis-compatible object.")

            if not isinstance(llm_result.summary, str):
                raise TypeError("ResumeAnalysis.summary must be a string.")

            resume_analysis = llm_result
            embeddings = embedding_service.embed_resume(resume_analysis)

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
                resume = await resume_repo.create_resume(
                    user_id=candidate.id,
                    raw_text=parsed_text,
                    file_path=str(pdf_file),
                )
                await session.flush()

                analysis_record = ResumeAnalysis(
                    resume_id=resume.id,
                    model_name=getattr(llm.provider, "model", "llm-model"),
                    summary=resume_analysis.summary,
                    skills=resume_analysis.skills,
                    strengths=resume_analysis.strengths,
                    weaknesses=resume_analysis.weaknesses,
                    experience=resume_analysis.experience,
                )
                session.add(analysis_record)

                embedding_record = ResumeEmbedding(
                    resume_id=resume.id,
                    model_name=model_name,
                    summary_embedding=summary_embedding,
                    skills_embedding=skills_embedding,
                    experience_embedding=experience_embedding,
                )
                session.add(embedding_record)

            print(f"Inserted Resume ID: {resume.id}")

        await session.commit()


if __name__ == "__main__":
    if sys.platform == 'win32':
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
    else:
        asyncio.run(main())
