from __future__ import annotations

from typing import Any

from src.backend.app.models.enrichment_profile import EnrichmentProfile
from src.backend.app.models.enums import EnrichmentStatus
from src.backend.app.repositories.base import BaseRepository
from src.backend.app.schemas.lexical_search_result import LexicalSearchResult


class EnrichmentRepository(BaseRepository):
    """Repository responsible for storing AI-generated candidate enrichment data."""

    @staticmethod
    def _to_profile(row: dict | None) -> EnrichmentProfile | None:
        if not row:
            return None
        return EnrichmentProfile(**row)

    async def create_profile(
    self,
    candidate_uuid: str,
    skills: list[str],
    summary: str,
    experience: str,
    github: str | None = None,
    linkedin: str | None = None,
    enrichment_status: EnrichmentStatus = EnrichmentStatus.ENRICHED,
    semantic_tags: list[str] | None = None,
    skill_matrix: dict[str, Any] | None = None,
    match_confidence_score: float | None = None,
    score_increase: float | None = None,
    ) -> EnrichmentProfile:
        # 1. Nếu semantic_tags không truyền vào, gán mặc định là mảng rỗng [] thay vì None
        if semantic_tags is None:
            semantic_tags = []

        payload = {
            "candidate_uuid": candidate_uuid,
            "enrichment_status": enrichment_status.value,
            "skills": skills,
            "summary": summary,
            "experience": experience,
            "github": github,
            "linkedin": linkedin,
            "semantic_tags": semantic_tags,
            "skill_matrix": skill_matrix,
            "match_confidence_score": match_confidence_score,
            "score_increase": score_increase,
        }

        # 2. Loại bỏ các key mang giá trị None để tránh vi phạm constraint trong DB
        data_to_insert = {k: v for k, v in payload.items() if v is not None}

        response = (
            self.client.table("enrichment_profiles")
            .insert(data_to_insert)
            .select("*")
            .execute()
        )

        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError("Failed to create enrichment profile.")
        return EnrichmentProfile(**row)

    async def update_profile(
        self,
        candidate_uuid: str,
        *,
        skills: list[str] | None = None,
        summary: str | None = None,
        experience: str | None = None,
        github: str | None = None,
        linkedin: str | None = None,
        semantic_tags: list[str] | None = None,
        skill_matrix: dict[str, Any] | None = None,
        match_confidence_score: float | None = None,
        score_increase: float | None = None,
        enrichment_status: EnrichmentStatus | None = None,
    ) -> EnrichmentProfile:
        if not any(
            value is not None
            for value in (
                skills,
                summary,
                experience,
                github,
                linkedin,
                semantic_tags,
                skill_matrix,
                match_confidence_score,
                score_increase,
                enrichment_status,
            )
        ):
            existing = await self.get_profile(candidate_uuid)
            if existing is None:
                raise ValueError(
                    f"EnrichmentProfile for candidate '{candidate_uuid}' not found."
                )
            return existing

        updates: dict[str, Any] = {}
        if skills is not None:
            updates["skills"] = skills
        if summary is not None:
            updates["summary"] = summary
        if experience is not None:
            updates["experience"] = experience
        if github is not None:
            updates["github"] = github
        if linkedin is not None:
            updates["linkedin"] = linkedin
        if semantic_tags is not None:
            updates["semantic_tags"] = semantic_tags
        if skill_matrix is not None:
            updates["skill_matrix"] = skill_matrix
        if match_confidence_score is not None:
            updates["match_confidence_score"] = match_confidence_score
        if score_increase is not None:
            updates["score_increase"] = score_increase
        if enrichment_status is not None:
            updates["enrichment_status"] = enrichment_status.value

        response = (
            self.client.table("enrichment_profiles")
            .update(updates)
            .eq("candidate_uuid", candidate_uuid)
            .select("*")
            .execute()
        )
        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError(
                f"EnrichmentProfile for candidate '{candidate_uuid}' not found."
            )
        return EnrichmentProfile(**row)

    async def update_status(
        self,
        candidate_uuid: str,
        status: EnrichmentStatus,
    ) -> EnrichmentProfile:
        return await self.update_profile(candidate_uuid, enrichment_status=status)

    async def get_profile(
        self,
        candidate_uuid: str,
    ) -> EnrichmentProfile | None:
        response = (
            self.client.table("enrichment_profiles")
            .select("*")
            .eq("candidate_uuid", candidate_uuid)
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_profile(row)

    async def get_profiles_by_candidate_ids(
        self,
        candidate_uuids: list[str],
    ) -> list[EnrichmentProfile]:
        if not candidate_uuids:
            return []

        response = (
            self.client.table("enrichment_profiles")
            .select("*")
            .in_("candidate_uuid", candidate_uuids)
            .execute()
        )
        return [EnrichmentProfile(**row) for row in response.data or []]

    async def get_candidate_ids_by_skills(
        self,
        required_skills: list[str],
        match_all: bool = True,
    ) -> list[str]:
        if not required_skills:
            return []

        response = self.client.rpc(
            "get_candidate_ids_by_skills",
            {"required_skills": required_skills},
        ).execute()
        return [row["candidate_uuid"] for row in response.data or []]

    async def search_profiles_lexically(
        self,
        query: str,
        top_k: int = 20,
        candidate_ids: list[str] | None = None,
    ) -> list[LexicalSearchResult]:
        if not query.strip():
            return []

        params: dict[str, Any] = {"query": query, "top_k": top_k}
        if candidate_ids:
            params["candidate_ids"] = candidate_ids

        response = self.client.rpc("search_profiles_lexically", params).execute()
        results: list[LexicalSearchResult] = []
        for row in response.data or []:
            matched_fields = row.get("matched_fields") or []
            if isinstance(matched_fields, str):
                matched_fields = [field for field in matched_fields.split(",") if field]

            results.append(
                LexicalSearchResult(
                    candidate_uuid=row["candidate_uuid"],
                    enrichment_profile_id=row["enrichment_profile_id"],
                    lexical_score=float(row["lexical_score"]),
                    matched_fields=list(matched_fields),
                )
            )

        return results