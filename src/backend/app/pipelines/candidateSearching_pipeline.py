import uuid

from backend.app.services.ranking_service import RankingService

from backend.app.schemas.resume_score import ResumeScore
from backend.app.repositories.resume_repository import ResumeRepository
from backend.app.repositories.requirement_embedding_repository import RequirementEmbeddingRepository
from sqlalchemy.ext.asyncio import AsyncSession
 

class SemanticPipeline:
    def __init__(self, ranking_service: RankingService, resume_repo: ResumeRepository, req_emb_repo: RequirementEmbeddingRepository):
        self.ranking_service = ranking_service

    async def rank_all_resumes_for_requirement(
        self, 
        requirement_id: uuid.UUID, 
        session: AsyncSession
    ) -> list[dict]:
        resume_repo = ResumeRepository(session)
        req_emb_repo = RequirementEmbeddingRepository(session)

        # 1. Lấy dữ liệu qua các Repository đã có
        req_emb = await req_emb_repo.get_by_id(requirement_id)
        data = await resume_repo.get_all_with_embeddings()
        
        # 2. Tách dữ liệu để gửi cho RankingService
        resumes_emb = [row[0] for row in data]
        resumes_data = [row[1] for row in data]

        # 3. Ranking
        return self.ranking_service.rank(req_emb, resumes_emb, resumes_data)