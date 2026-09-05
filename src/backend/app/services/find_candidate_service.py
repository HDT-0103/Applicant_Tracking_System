from __future__ import annotations

import asyncio
from collections.abc import Sequence
from typing import Any

from src.backend.app.dtos.find_candidate import (
    FindCandidateRequest,
    FindCandidateResult,
)


class FindCandidateService:
    """Search candidates without creating or changing an application."""

    def __init__(
        self,
        search_repository: Any,
        candidate_repository: Any,
        embedding_service: Any,
        lexical_weight: float = 0.35,
        semantic_weight: float = 0.65,
    ) -> None:
        self.search_repository = search_repository
        self.candidate_repository = candidate_repository
        self.embedding_service = embedding_service
        self.lexical_weight = lexical_weight
        self.semantic_weight = semantic_weight

    async def find(
        self,
        request: FindCandidateRequest,
        scope_candidate_ids: Sequence[str] | None = None,
    ) -> list[FindCandidateResult]:
        """Tìm ad-hoc. `scope_candidate_ids` là phạm vi của người gọi.

        `None` = không giới hạn (admin script); `[]` = không thấy ai. Phạm vi
        được ép vào bộ lọc cứng TRƯỚC khi xếp hạng, không lọc sau top-k: lọc
        sau thì một HR có ít tin nhận về rỗng dù ứng viên của mình đứng hạng 11.
        """
        candidate_ids: Sequence[str] | None = None
        if scope_candidate_ids is not None:
            candidate_ids = [str(c) for c in scope_candidate_ids]
            if not candidate_ids:
                return []
        if request.must_have_skills:
            skill_matches = await self.search_repository.get_candidate_ids_by_skills(
                request.must_have_skills
            )
            matched = [str(item.candidate_uuid) for item in skill_matches]
            if candidate_ids is not None:
                allowed = set(candidate_ids)
                matched = [c for c in matched if c in allowed]
            candidate_ids = matched
            if not candidate_ids:
                return []

        lexical_results = await self.search_repository.search_profiles_lexically(
            query=request.role_description,
            top_k=request.top_k,
            candidate_ids=candidate_ids,
        )

        semantic_query = request.role_description
        if request.experience_expectations:
            semantic_query = (
                f"{semantic_query}\nExperience expectations: "
                f"{request.experience_expectations}"
            )
        query_embedding = await asyncio.to_thread(
            self.embedding_service.embed_text,
            f"query: {semantic_query}",
        )
        semantic_results = await self.search_repository.search_similar_embeddings(
            embedding=query_embedding,
            top_k=request.top_k,
            candidate_ids=candidate_ids,
            source_types=["summary", "experience"],
        )

        ranked_scores = self._fuse_scores(lexical_results, semantic_results)
        if not ranked_scores:
            return []

        details = await self.candidate_repository.get_candidate_details(
            [candidate_uuid for candidate_uuid, _ in ranked_scores]
        )
        details_by_id = {str(row["candidate_uuid"]): row for row in details}

        results: list[FindCandidateResult] = []
        for candidate_uuid, scores in ranked_scores:
            row = details_by_id.get(str(candidate_uuid))
            if row is None:
                continue
            results.append(
                FindCandidateResult(
                    candidate_uuid=str(candidate_uuid),
                    overall_score=scores["overall_score"],
                    lexical_score=scores["lexical_score"],
                    semantic_score=scores["semantic_score"],
                    full_name=row.get("full_name"),
                    email=row.get("email"),
                    phone=row.get("phone"),
                    summary=row.get("summary") or "",
                    skills=row.get("skills") or [],
                    github_username=row.get("github_username"),
                    github_url=row.get("github_url"),
                    linkedin_url=row.get("linkedin_url"),
                )
            )
        return results[: request.top_k]

    def _fuse_scores(
        self, lexical_results: list[Any], semantic_results: list[Any]
    ) -> list[tuple[str, dict[str, float]]]:
        max_lexical = max(
            (float(item.lexical_score) for item in lexical_results), default=0.0
        )
        lexical_scores = (
            {
                str(item.candidate_uuid): float(item.lexical_score) / max_lexical
                for item in lexical_results
            }
            if max_lexical > 0
            else {}
        )
        semantic_scores: dict[str, float] = {}
        for item in semantic_results:
            candidate_uuid = str(item.candidate_uuid)
            semantic_scores[candidate_uuid] = max(
                semantic_scores.get(candidate_uuid, 0.0),
                float(item.similarity_score),
            )

        ranked: list[tuple[str, dict[str, float]]] = []
        for candidate_uuid in set(lexical_scores) | set(semantic_scores):
            lexical_score = lexical_scores.get(candidate_uuid, 0.0)
            semantic_score = semantic_scores.get(candidate_uuid, 0.0)
            overall_score = (
                self.lexical_weight * lexical_score
                + self.semantic_weight * semantic_score
            )
            ranked.append(
                (
                    candidate_uuid,
                    {
                        "lexical_score": round(lexical_score, 4),
                        "semantic_score": round(semantic_score, 4),
                        "overall_score": round(overall_score, 4),
                    },
                )
            )
        return sorted(ranked, key=lambda item: item[1]["overall_score"], reverse=True)