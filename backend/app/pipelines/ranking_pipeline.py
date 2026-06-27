from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.ranking_service import RankingService

from backend.app.schemas.resume_analysis import ResumeAnalysis
from backend.app.schemas.requirement_analysis import RequirementAnalysis

from backend.app.schemas.resume_score import ResumeScore


class SemanticPipeline:

    def __init__(
        self,
        embedding_service: EmbeddingService,
        ranking_service: RankingService
    ):
        self.embedding_service = embedding_service
        self.ranking_service = ranking_service

    def process(
        self,
        requirement: RequirementAnalysis,
        resumes: list[ResumeAnalysis]
    ) -> list[ResumeScore]:

        requirement_embedding = (
            self.embedding_service.embed_requirement(
                requirement
            )
        )

        resume_embeddings = []

        for resume in resumes:
            embedding = (
                self.embedding_service.embed_resume(
                    resume
                )
            )

            resume_embeddings.append(
                embedding
            )

        scores = self.ranking_service.rank(
            requirement_embedding,
            resume_embeddings
        )

        return scores