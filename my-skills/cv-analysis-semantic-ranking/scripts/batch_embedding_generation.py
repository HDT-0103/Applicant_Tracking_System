#!/usr/bin/env python3
"""
Batch script to generate OpenAI embeddings for candidate profiles (optional enhancement).
Use this to backfill vector embeddings for semantic search over parsed candidate data.

Requires OPENAI_API_KEY to be set in .env
Targets the candidate_profiles table in Supabase (stores embedding as JSONB column).
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, List

backend_path = Path(__file__).parent.parent.parent.parent / "src" / "backend"
sys.path.insert(0, str(backend_path))

from openai import AsyncOpenAI
from modules.shared.infrastructure.config import get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client
import structlog

logger = structlog.get_logger()


class EmbeddingGenerator:
    def __init__(self):
        self.settings = get_settings()
        self.supabase = get_supabase_client(self.settings, use_admin=True)
        self.openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self.embedding_model = self.settings.openai_embedding_model or "text-embedding-3-small"
        self.batch_size = 20

    async def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        response = await self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=texts
        )
        return [item.embedding for item in response.data]

    def get_profiles_without_embeddings(self) -> List[dict]:
        result = self.supabase.table("candidate_profiles") \
            .select("candidate_uuid, full_name, skills, experience, education") \
            .is_("embedding", "null") \
            .limit(500) \
            .execute()
        return result.data or []

    def prepare_profile_text(self, profile: dict) -> str:
        parts = [profile.get("full_name", "")]
        skills = profile.get("skills", [])
        if isinstance(skills, list):
            parts.append(" ".join(skills))
        exp = profile.get("experience", [])
        if isinstance(exp, list):
            for e in exp:
                if isinstance(e, dict):
                    parts.append(f"{e.get('title', '')} at {e.get('company', '')}")
        edu = profile.get("education", [])
        if isinstance(edu, list):
            for e in edu:
                if isinstance(e, dict):
                    parts.append(f"{e.get('degree', '')} at {e.get('school', '')}")
        return " ".join(parts)

    def update_embedding(self, candidate_uuid: str, embedding: List[float]):
        self.supabase.table("candidate_profiles") \
            .update({"embedding": json.dumps(embedding)}) \
            .eq("candidate_uuid", candidate_uuid) \
            .execute()

    async def backfill(self):
        profiles = self.get_profiles_without_embeddings()
        total = len(profiles)
        if total == 0:
            logger.info("no_profiles_need_embeddings")
            return
        logger.info("profiles_to_process", count=total)
        for i in range(0, total, self.batch_size):
            batch = profiles[i:i + self.batch_size]
            texts = [self.prepare_profile_text(p) for p in batch]
            uuids = [p["candidate_uuid"] for p in batch]
            try:
                embeddings = await self.generate_batch_embeddings(texts)
                for uuid, emb in zip(uuids, embeddings):
                    self.update_embedding(uuid, emb)
                logger.info("batch_completed", batch=i, count=len(batch))
            except Exception as e:
                logger.error("batch_failed", batch=i, error=str(e))

    async def run(self):
        await self.backfill()


async def main():
    generator = EmbeddingGenerator()
    await generator.run()


if __name__ == "__main__":
    asyncio.run(main())
