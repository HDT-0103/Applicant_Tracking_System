from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from src.backend.app.models.application import Application
from src.backend.app.models.enums import EmbeddingSource, EnrichmentStatus, JobEmbeddingSource
from src.backend.app.repositories.application_repository import ApplicationRepository
from src.backend.app.repositories.embedding_repository import EmbeddingRepository
from src.backend.app.repositories.enrichment_repository import EnrichmentRepository
from src.backend.app.repositories.job_embedding_repository import JobEmbeddingRepository
from src.backend.app.repositories.job_posting_repository import JobPostingRepository
from src.backend.app.schemas.embedding import EmbeddingCreate
from src.backend.app.schemas.resume_analysis import ResumeAnalysis
from src.backend.app.services.embedding_service import EmbeddingService
from src.backend.app.services.llm_service import LLMService
from src.backend.app.services.parser_service import ParserService

logger = logging.getLogger(__name__)


class CVProcessingPipeline:
    """Pipeline điều phối toàn bộ quá trình xử lý CV khi ứng viên Nộp đơn / Upload CV.

    Luồng xử lý (100% qua Repository):
    1. Parse PDF/Docx -> Cleaned Text (ParserService)
    2. LLM Analysis -> Structured ResumeAnalysis (LLMService)
    3. Save/Update Enrichment Profile (EnrichmentRepository)
    4. Generate Multi-Embeddings (EmbeddingService -> EmbeddingRepository)
    5. Retrieve Job Context & Job Embeddings (JobPostingRepository & JobEmbeddingRepository)
    6. Calculate Matching Scores & Update Application (ApplicationRepository)
    """

    def __init__(
        self,
        enrichment_repo: EnrichmentRepository,
        embedding_repo: EmbeddingRepository,
        application_repo: ApplicationRepository,
        job_posting_repo: JobPostingRepository,
        job_embedding_repo: JobEmbeddingRepository,
        parser_service: ParserService | None = None,
        llm_service: LLMService | None = None,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self.enrichment_repo = enrichment_repo
        self.embedding_repo = embedding_repo
        self.application_repo = application_repo
        self.job_posting_repo = job_posting_repo
        self.job_embedding_repo = job_embedding_repo

        self.parser_service = parser_service or ParserService()
        self.llm_service = llm_service  # Should be injected
        self.embedding_service = embedding_service or EmbeddingService()

    async def process_cv(
        self,
        file_path: str,
        candidate_uuid: str,
        job_posting_id: UUID,
        application_id: UUID,
        github_url: str | None = None,
        linkedin_url: str | None = None,
    ) -> Application:
        """Thực thi Pipeline xử lý CV end-to-end."""
        logger.info(
            f"Starting CV Processing for candidate_uuid={candidate_uuid}, "
            f"job_posting_id={job_posting_id}, application_id={application_id}"
        )

        # -------------------------------------------------------------
        # Step 1: Parse CV File
        # -------------------------------------------------------------
        parsed_text = self.parser_service.process(file_path)

        # -------------------------------------------------------------
        # Step 2: LLM Analysis
        # -------------------------------------------------------------
        if self.llm_service is None:
            raise ValueError("LLMService is required for CVProcessingPipeline.")
        analysis: ResumeAnalysis = self.llm_service.analyze_resume(parsed_text)

        # Convert experience list to JSON/text format suitable for profile storage
        exp_text = json.dumps(analysis.experience, ensure_ascii=False) if analysis.experience else ""

        # -------------------------------------------------------------
        # Step 3: Save or Update Enrichment Profile via Repository
        # -------------------------------------------------------------
        existing_profile = await self.enrichment_repo.get_profile(candidate_uuid)
        if existing_profile:
            profile = await self.enrichment_repo.update_profile(
                candidate_uuid=candidate_uuid,
                skills=analysis.skills,
                summary=analysis.summary,
                experience=exp_text,
                github=github_url,
                linkedin=linkedin_url,
                enrichment_status=EnrichmentStatus.ENRICHED,
            )
        else:
            profile = await self.enrichment_repo.create_profile(
                candidate_uuid=candidate_uuid,
                skills=analysis.skills,
                summary=analysis.summary,
                experience=exp_text,
                github=github_url,
                linkedin=linkedin_url,
                enrichment_status=EnrichmentStatus.ENRICHED,
            )

        # -------------------------------------------------------------
        # Step 4: Generate & Save Multi-Embeddings via Repository
        # -------------------------------------------------------------
        embeddings_to_create: list[EmbeddingCreate] = []

        # 4a. Summary Embedding
        if analysis.summary:
            summary_vector = await self.embedding_service.generate_embedding(analysis.summary)
            embeddings_to_create.append(
                EmbeddingCreate(
                    enrichment_profile_id=profile.id,
                    source_type=EmbeddingSource.SUMMARY,
                    text_content=analysis.summary,
                    embedding=summary_vector,
                )
            )

        # 4b. Experience Embedding
        if exp_text:
            exp_vector = await self.embedding_service.generate_embedding(exp_text)
            embeddings_to_create.append(
                EmbeddingCreate(
                    enrichment_profile_id=profile.id,
                    source_type=EmbeddingSource.EXPERIENCE,
                    text_content=exp_text,
                    embedding=exp_vector,
                )
            )

        if embeddings_to_create:
            await self.embedding_repo.create_embeddings(embeddings_to_create)

        # -------------------------------------------------------------
        # Step 5: Get Job Context & Embeddings for Score Calculation
        # -------------------------------------------------------------
        job_posting = await self.job_posting_repo.get_job_posting(job_posting_id)
        if not job_posting:
            raise ValueError(f"Job posting with ID {job_posting_id} not found.")

        job_embeddings = await self.job_embedding_repo.get_embeddings_by_job_posting(job_posting_id)

        # -------------------------------------------------------------
        # Step 6: Calculate Scores & Update Application via Repository
        # -------------------------------------------------------------
        # Note: Ở đây tính toán Similarity Cosine giữa candidate embeddings & job embeddings
        summary_score = self._calculate_similarity(embeddings_to_create, job_embeddings, EmbeddingSource.SUMMARY)
        experience_score = self._calculate_similarity(embeddings_to_create, job_embeddings, EmbeddingSource.EXPERIENCE)
        github_score = None  # GitHub crawler do bên khác xử lý như trao đổi

        # Tính Overall Score đơn giản (hoặc theo trọng số)
        valid_scores = [s for s in (summary_score, experience_score) if s is not None]
        overall_score = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0

        updated_app = await self.application_repo.update_matching_scores(
            application_id=application_id,
            summary_score=summary_score,
            experience_score=experience_score,
            github_score=github_score,
            overall_score=overall_score,
        )

        logger.info(
            f"Successfully processed CV for candidate {candidate_uuid}. "
            f"Updated overall_score={overall_score:.4f}"
        )
        return updated_app

    def _calculate_similarity(
        self,
        candidate_embeddings: list[EmbeddingCreate],
        job_embeddings: list[Any],
        source: EmbeddingSource,
    ) -> float | None:
        """Helper tính Cosine Similarity giữa Candidate embedding và Job embedding."""
        cand_emb = next((e for e in candidate_embeddings if e.source_type == source), None)
        if not cand_emb or not job_embeddings:
            return None

        # Ví dụ ghép vector job hoặc lấy vector job đầu tiên
        job_vec = job_embeddings[0].embedding
        cand_vec = cand_emb.embedding

        # Dot product cho 2 vector đã normalize
        dot_product = sum(a * b for a, b in zip(cand_vec, job_vec))
        return float(dot_product)