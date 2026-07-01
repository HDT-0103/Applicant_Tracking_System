from datetime import datetime, timezone
from typing import Dict, Optional
import structlog

from .models import CandidateRecord

logger = structlog.get_logger(__name__)

candidate_store: Dict[str, CandidateRecord] = {}


def save_candidate(candidate: CandidateRecord) -> CandidateRecord:
    logger.debug("candidate_repository.save", uuid=candidate.uuid, github_username=candidate.github_username, linkedin_url=candidate.linkedin_url)
    candidate_store[candidate.uuid] = candidate
    return candidate


def get_candidate(uuid: str) -> Optional[CandidateRecord]:
    candidate = candidate_store.get(uuid)
    if candidate:
        logger.debug(
            "candidate_repository.get.found",
            uuid=uuid,
            github_username=candidate.github_username,
            linkedin_url=candidate.linkedin_url,
            full_name=candidate.full_name,
        )
    else:
        logger.debug("candidate_repository.get.not_found", uuid=uuid)
    return candidate


def update_candidate(uuid: str, **kwargs) -> Optional[CandidateRecord]:
    candidate = candidate_store.get(uuid)
    if not candidate:
        logger.warning("candidate_repository.update.not_found", uuid=uuid)
        return None
    for key, value in kwargs.items():
        setattr(candidate, key, value)
    candidate.updated_at = datetime.now(timezone.utc).isoformat()
    logger.debug("candidate_repository.update", uuid=uuid, updates=kwargs)
    return candidate
