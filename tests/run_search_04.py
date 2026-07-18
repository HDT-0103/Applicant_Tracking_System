from __future__ import annotations

import asyncio
import sys
from sqlalchemy import select

from src.backend.app.models import RequirementEmbedding, ResumeEmbedding
from src.backend.app.repositories.requirement_embedding_repository import RequirementEmbeddingRepository
from src.backend.app.repositories.resume_repository import ResumeRepository
from src.backend.app.services.ranking_service import RankingService
from tests.common_07 import async_session_factory


def to_scores(row) -> tuple[str, float, float, float, float]:
    resume_data = row["resume_data"] if isinstance(row, dict) else row.resume_data
    final_score = row["final_score"] if isinstance(row, dict) else row.final_score
    return (
        str(getattr(resume_data, "id", "")),
        float(getattr(row, "skills_score", 0.0)) if hasattr(row, "skills_score") else 0.0,
        float(getattr(row, "experience_score", 0.0)) if hasattr(row, "experience_score") else 0.0,
        float(getattr(row, "summary_score", 0.0)) if hasattr(row, "summary_score") else 0.0,
        float(final_score),
    )


async def main() -> None:
    async with async_session_factory() as session:
        requirement_stmt = select(RequirementEmbedding).order_by(RequirementEmbedding.created_at.desc()).limit(1)
        req_emb = await session.scalar(requirement_stmt)
        if req_emb is None:
            raise RuntimeError("No RequirementEmbedding found.")

        resume_repo = ResumeRepository(session)
        data = await resume_repo.get_all_with_embeddings()
        if not data:
            print("No resume embeddings found.")
            return

        resumes_emb = [row[0] for row in data]
        resumes_data = [row[1] for row in data]

        ranking_service = RankingService()
        ranked = ranking_service.rank(req_emb, resumes_emb, resumes_data)

        print("Resume ID | Skill score | Experience score | Summary score | Final score")
        for item in ranked:
            resume_data = item["resume_data"]
            score = item["final_score"]
            skill_score = ranking_service.cosine(req_emb.skills_embedding, item["resume_data"].skills if hasattr(item["resume_data"], "skills") else item["resume_data"])
            print(f"{getattr(resume_data, 'id', '')} | {skill_score} | {ranking_service.cosine(req_emb.experience_embedding, resumes_emb[0].experience_embedding)} | {ranking_service.cosine(req_emb.summary_embedding, resumes_emb[0].summary_embedding)} | {score}")


if __name__ == "__main__":
    if sys.platform == 'win32':
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
    else:
        asyncio.run(main())
