from __future__ import annotations

from typing import Any

from src.backend.app.models.github_profile import GitHubProfile
from src.backend.app.repositories.base import BaseRepository

class GitHubProfileRepository(BaseRepository):
    """Repository responsible for CRUD operations on github_profiles."""

    _COLUMNS = (
        "id,candidate_uuid,public_repos_count,top_languages,"
        "readme_content,repos,created_at,updated_at"
    )

    @staticmethod
    def _to_profile(row: dict | None) -> GitHubProfile | None:
        if not row:
            return None
        return GitHubProfile(**row)

    async def get_github_profile(self, candidate_uuid: str) -> GitHubProfile | None:
        response = (
            self.client.table("github_profiles")
            .select(self._COLUMNS)
            .eq("candidate_uuid", candidate_uuid)
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_profile(row)

    async def upsert_github_profile(
        self,
        candidate_uuid: str,
        public_repos_count: int = 0,
        top_languages: dict[str, Any] | None = None,
        readme_content: str | None = None,
        repos: list[dict[str, Any]] | None = None,
    ) -> GitHubProfile:
        """
        Create or update a candidate's raw GitHub profile.
        Does not perform any AI/BM25 logic.
        """
        if top_languages is None:
            top_languages = {}
        if repos is None:
            repos = []

        response = (
            self.client.table("github_profiles")
            .upsert(
                {
                    "candidate_uuid": candidate_uuid,
                    "public_repos_count": public_repos_count,
                    "top_languages": top_languages,
                    "readme_content": readme_content,
                    "repos": repos,
                },
                on_conflict="candidate_uuid"
            )
            .select(self._COLUMNS)
            .execute()
        )

        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError("Failed to upsert GitHub profile.")

        return GitHubProfile(**row)