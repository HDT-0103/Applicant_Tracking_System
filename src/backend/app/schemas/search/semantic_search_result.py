from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SemanticSearchResult(BaseModel):
    candidate_uuid: UUID
    enrichment_profile_id: UUID
    source_type: str
    matched_text: str
    similarity_score: float

    model_config = ConfigDict(frozen=True)