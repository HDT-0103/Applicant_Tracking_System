import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from modules.review.domain.models import CvReview
from modules.review.domain.repo_interface import IReviewRepo

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "stored_data")
STORAGE_PATH = os.path.join(STORAGE_DIR, "reviews.json")


def _load() -> dict[str, CvReview]:
    if not os.path.isfile(STORAGE_PATH):
        return {}
    with open(STORAGE_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {k: CvReview(**v) for k, v in raw.items()}


def _persist(store: dict[str, CvReview]) -> None:
    os.makedirs(STORAGE_DIR, exist_ok=True)
    with open(STORAGE_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {k: v.model_dump() for k, v in store.items()},
            f,
            indent=2,
            default=str,
        )


class InMemoryReviewRepo(IReviewRepo):
    def __init__(self) -> None:
        self._store = _load()

    def save(self, review: CvReview) -> CvReview:
        key = f"{review.candidate_uuid}::{review.reviewer_role}"
        existing = self._store.get(key)
        if existing:
            review.id = existing.id
            review.created_at = existing.created_at
            review.updated_at = datetime.now(timezone.utc).isoformat()
        else:
            review.id = str(uuid.uuid4())
        self._store[key] = review
        _persist(self._store)
        return review

    def get_by_candidate(self, candidate_uuid: str) -> list[CvReview]:
        return [
            r for r in self._store.values() if r.candidate_uuid == candidate_uuid
        ]

    def get_by_reviewer(
        self, candidate_uuid: str, reviewer_id: str
    ) -> Optional[CvReview]:
        return self._store.get(f"{candidate_uuid}::{reviewer_id}")
