from pydantic import BaseModel
from src.backend.app.models.enums import EmbeddingSource
from uuid import UUID
from enum import Enum
from pydantic import ConfigDict
# DTO cho Bulk Insert
class EmbeddingSource(str, Enum):
    SUMMARY = "summary"
    EXPERIENCE = "experience"
    GITHUB = "github"
    LINKEDIN = "linkedin"


class EmbeddingSearchResult(BaseModel):
    candidate_uuid: str
    enrichment_profile_id: UUID
    source_type: EmbeddingSource
    matched_text: str
    similarity_score: float

    model_config = ConfigDict(from_attributes=True)

class EmbeddingCreate(BaseModel):
    enrichment_profile_id: UUID
    source_type: EmbeddingSource
    text_content: str
    embedding: list[float]
    model_name: str = "intfloat/multilingual-e5-base"