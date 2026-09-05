"""
Generate and persist embeddings for job postings into public.job_embeddings.

Each PUBLISHED job gets up to 2 vectors (source_type):
  * summary       — job_title + department + description
  * requirements  — requirements + key_responsibilities

Skills are deliberately NOT embedded: they stay as text[] on jobs_posting
(must_have_skills / nice_to_have_skills) so the scoring side can hard-filter
exactly (e.g. must_have_skills @> ARRAY['python']) instead of fuzzy cosine.

JD text is embedded as E5 "query:"; the candidate side must embed resumes with
the same model using "passage:" (see embedding_service.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

import structlog

from modules.scoring.application.embedding_service import get_embedding_provider
from modules.shared.infrastructure.config import Settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)


class JobNotFoundError(Exception):
    pass


@dataclass
class JobEmbeddingResult:
    job_posting_id: str
    model_name: str
    embedded: List[str] = field(default_factory=list)
    skipped: bool = False


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _join_parts(parts: List[Optional[str]]) -> str:
    return "\n".join(part.strip() for part in parts if part and part.strip())


def _build_job_texts(job: dict) -> dict[str, str]:
    """Map source_type -> text, dropping empty sections."""
    texts = {
        "summary": _join_parts([
            job.get("job_title"),
            job.get("department"),
            job.get("description"),
        ]),
        "requirements": _join_parts([
            job.get("requirements"),
            job.get("key_responsibilities"),
        ]),
    }
    return {source: text for source, text in texts.items() if text}


async def ensure_job_embeddings(
    job_id: str,
    settings: Settings,
    force: bool = False,
    owner_id: Optional[str] = None,
) -> JobEmbeddingResult:
    """
    Embed a job posting if its embeddings are missing or stale
    (jobs_posting.updated_at newer than the stored vectors). `force` always
    re-embeds — use after editing the JD or switching models.

    `owner_id`, when given, restricts the call to postings created by that
    user: a posting owned by someone else is reported as not found, the same
    way the catalog routes treat it. `None` skips the check (admin scripts).
    """
    client = get_supabase_client(settings, use_admin=True)
    if client is None:
        raise RuntimeError("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)")

    provider = get_embedding_provider(settings)

    job_response = (
        client.table("jobs_posting")
        .select(
            "id,job_title,department,description,requirements,key_responsibilities,"
            "updated_at,created_by"
        )
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    rows = job_response.data or []
    if not rows:
        raise JobNotFoundError(job_id)
    job = rows[0]
    if owner_id is not None and job.get("created_by") != owner_id:
        # Không phân biệt "không có" với "của người khác": 404 cho cả hai, nếu
        # không thì mã trạng thái tự nó là công cụ dò id tin của người khác.
        raise JobNotFoundError(job_id)

    texts = _build_job_texts(job)
    if not texts:
        logger.warning("job_embeddings.no_text", job_id=job_id)
        return JobEmbeddingResult(job_posting_id=job_id, model_name=provider.model_name, skipped=True)

    if not force:
        existing_response = (
            client.table("job_embeddings")
            .select("source_type,created_at")
            .eq("job_posting_id", job_id)
            .eq("model_name", provider.model_name)
            .execute()
        )
        existing = existing_response.data or []
        existing_sources = {row["source_type"] for row in existing}
        job_updated_at = _parse_timestamp(job.get("updated_at"))
        oldest_embedding = min(
            (ts for row in existing if (ts := _parse_timestamp(row.get("created_at")))),
            default=None,
        )
        stale = bool(job_updated_at and oldest_embedding and job_updated_at > oldest_embedding)
        if existing_sources >= set(texts) and not stale:
            return JobEmbeddingResult(
                job_posting_id=job_id, model_name=provider.model_name, skipped=True
            )

    sources = list(texts)
    vectors = await provider.embed([texts[source] for source in sources], kind="query")

    payload = [
        {
            "job_posting_id": job_id,
            "source_type": source,
            "text_content": texts[source],
            "embedding": str(vector),
            "model_name": provider.model_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        for source, vector in zip(sources, vectors)
    ]
    client.table("job_embeddings").upsert(
        payload, on_conflict="job_posting_id,source_type,model_name"
    ).execute()

    logger.info(
        "job_embeddings.upserted",
        job_id=job_id,
        sources=sources,
        model=provider.model_name,
    )
    return JobEmbeddingResult(
        job_posting_id=job_id, model_name=provider.model_name, embedded=sources
    )
