from __future__ import annotations

from uuid import uuid4
import json
import pytest

from src.backend.app.models.enums import CandidateStatus
from src.backend.app.models.enums import EmbeddingSource as ModelEmbeddingSource
from src.backend.app.models.enums import EnrichmentStatus
from src.backend.app.repositories.embedding_repository import EmbeddingRepository
from src.backend.app.repositories.enrichment_repository import EnrichmentRepository
from src.backend.app.schemas.embedding import EmbeddingCreate, EmbeddingSource as SchemaEmbeddingSource
from src.backend.app.services.embedding_service import EmbeddingService


@pytest.fixture(scope="session")
def embedding_service():
    print("\n[SETUP] Loading EmbeddingService (this may take a while on first run)...")
    service = EmbeddingService()
    print("[SETUP] EmbeddingService loaded successfully.")
    return service


@pytest.mark.asyncio
async def test_create_embedding_and_get_embeddings_by_profile(
    service_role_client,
    embedding_service,
):
    candidate_uuid = str(uuid4())
    email = f"embedding-{candidate_uuid[:8]}@example.com"
    profile_id = None
    embedding_id = None

    service_role_client.table("candidates").insert(
        {
            "uuid": candidate_uuid,
            "full_name": "Embedding Candidate",
            "email": email,
            "status": CandidateStatus.ACTIVE.value,
        }
    ).execute()
    print("[TEST] Candidate created.")

    enrichment_repository = EnrichmentRepository(session=None)
    embedding_repository = EmbeddingRepository(session=None)

    try:
        profile = await enrichment_repository.create_profile(
            candidate_uuid=candidate_uuid,  
            skills=["Python"],
            summary="Semantic profile",
            experience="Backend engineering",
            enrichment_status=EnrichmentStatus.ENRICHED,
        )
        profile_id = str(profile.id)
        print("[TEST] Enrichment profile created.")

        print("[TEST] Generating embedding...")
        vector = embedding_service.embed_text("Semantic profile")
        print(f"[TEST] Embedding generated ({len(vector)} dimensions).")

        assert len(vector) == 768

        created_embedding = await embedding_repository.create_embedding(
            enrichment_profile_id=profile.id,
            source_type=ModelEmbeddingSource.SUMMARY,
            text_content="Semantic profile",
            embedding=vector,
        )
        embedding_id = str(created_embedding.id)
        print("[TEST] Embedding inserted.")

        print("[TEST] Fetching embedding...")
        stored = (
            service_role_client.table("embeddings")
            .select("id, enrichment_profile_id, source_type, text_content, embedding, model_name")
            .eq("id", embedding_id)
            .limit(1)
            .execute()
        )
        assert stored.data, "Expected embedding row to exist after insert."
        row = stored.data[0]
        
        assert row["enrichment_profile_id"] == profile_id
        assert row["source_type"] == ModelEmbeddingSource.SUMMARY.value
        assert row["text_content"] == "Semantic profile"
        assert row["model_name"] == "intfloat/multilingual-e5-base"
        
        embedding_val = row["embedding"]
        if isinstance(embedding_val, str):
            embedding_val = json.loads(embedding_val)

        assert len(embedding_val) == 768
        assert embedding_val == pytest.approx(vector)  # Dùng biến embedding_val đã parse

        fetched = await embedding_repository.get_embeddings_by_profile(profile.id)
        assert len(fetched) == 1
        assert str(fetched[0].id) == embedding_id
        assert str(fetched[0].enrichment_profile_id) == profile_id
        assert fetched[0].source_type == ModelEmbeddingSource.SUMMARY.value
        assert fetched[0].text_content == "Semantic profile"
        
        print("[TEST] Repository returned expected result.")

    finally:
        print("[CLEANUP] Removing test data...")
        if embedding_id is not None:
            service_role_client.table("embeddings").delete().eq("id", embedding_id).execute()
        if profile_id is not None:
            service_role_client.table("enrichment_profiles").delete().eq("id", profile_id).execute()
        service_role_client.table("candidates").delete().eq("uuid", candidate_uuid).execute()


@pytest.mark.asyncio
async def test_create_embeddings_inserts_multiple_rows(
    service_role_client,
    embedding_service,
):
    candidate_uuid = str(uuid4())
    email = f"embedding-batch-{candidate_uuid[:8]}@example.com"
    profile_id = None
    embedding_ids: list[str] = []

    service_role_client.table("candidates").insert(
        {
            "uuid": candidate_uuid,
            "full_name": "Batch Embedding Candidate",
            "email": email,
            "status": CandidateStatus.ACTIVE.value,
        }
    ).execute()
    print("[TEST] Candidate created.")

    enrichment_repository = EnrichmentRepository(session=None)
    embedding_repository = EmbeddingRepository(session=None)

    try:
        profile = await enrichment_repository.create_profile(
            candidate_uuid=candidate_uuid,
            skills=["Python"],
            summary="Batch profile",
            experience="Backend engineering",
            enrichment_status=EnrichmentStatus.ENRICHED,
        )
        profile_id = str(profile.id)
        print("[TEST] Enrichment profile created.")

        print("[TEST] Generating batch embeddings...")
        summary_vector = embedding_service.embed_text("Batch profile")
        experience_vector = embedding_service.embed_text("Backend engineering")

        assert len(summary_vector) == 768
        assert len(experience_vector) == 768
        print("[TEST] Batch embeddings generated.")

        created_embeddings = await embedding_repository.create_embeddings(
            [
                EmbeddingCreate(
                    enrichment_profile_id=profile.id,
                    source_type=SchemaEmbeddingSource.SUMMARY,
                    text_content="Batch profile",
                    embedding=summary_vector,
                ),
                EmbeddingCreate(
                    enrichment_profile_id=profile.id,
                    source_type=SchemaEmbeddingSource.EXPERIENCE,
                    text_content="Backend engineering",
                    embedding=experience_vector,
                ),
            ]
        )
        embedding_ids = [str(item.id) for item in created_embeddings]
        print("[TEST] Batch embeddings inserted.")

        print("[TEST] Fetching embedding...")
        fetched = await embedding_repository.get_embeddings_by_profile(profile.id)
        
        assert len(fetched) == 2
        assert {row.text_content for row in fetched} == {"Batch profile", "Backend engineering"}
        assert {row.source_type for row in fetched} == {
            ModelEmbeddingSource.SUMMARY.value,
            ModelEmbeddingSource.EXPERIENCE.value,
        }
        
        print("[TEST] Repository returned expected result.")

    finally:
        print("[CLEANUP] Removing test data...")
        for embedding_id in embedding_ids:
            service_role_client.table("embeddings").delete().eq("id", embedding_id).execute()
        if profile_id is not None:
            service_role_client.table("enrichment_profiles").delete().eq("id", profile_id).execute()
        service_role_client.table("candidates").delete().eq("uuid", candidate_uuid).execute()