"""
Stage 0 persistence for the ingestion flow.

Writes the durable records that anchor a submission in the database:
public.resumes (the uploaded file) and public.applications (candidate <-> job
link). The candidates row itself is upserted via SupabaseCandidateService
before these run — both tables FK to candidates.uuid.
"""

from typing import Optional

import structlog
from supabase import Client

logger = structlog.get_logger(__name__)


class ApplicationRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    def create_resume(
        self,
        candidate_uuid: str,
        filename: Optional[str],
        file_path: str,
    ) -> str:
        result = (
            self._client.table("resumes")
            .insert(
                {
                    "candidate_uuid": candidate_uuid,
                    "filename": filename,
                    "file_path": file_path,
                }
            )
            .execute()
        )
        if not result.data:
            raise RuntimeError(f"resumes insert returned no data for candidate {candidate_uuid}")

        resume_id = result.data[0]["id"]
        logger.info(
            "ingestion.resume_created",
            candidate_uuid=candidate_uuid,
            resume_id=resume_id,
        )
        return resume_id

    def create_application(
        self,
        candidate_uuid: str,
        job_posting_id: str,
        resume_id: str,
    ) -> str:
        result = (
            self._client.table("applications")
            .insert(
                {
                    "candidate_uuid": candidate_uuid,
                    "job_posting_id": job_posting_id,
                    "resume_id": resume_id,
                    "status": "SUBMITTED",
                }
            )
            .execute()
        )
        if not result.data:
            raise RuntimeError(
                f"applications insert returned no data for candidate {candidate_uuid}, job {job_posting_id}"
            )

        application_id = result.data[0]["id"]
        logger.info(
            "ingestion.application_created",
            candidate_uuid=candidate_uuid,
            job_posting_id=job_posting_id,
            resume_id=resume_id,
            application_id=application_id,
        )
        return application_id
