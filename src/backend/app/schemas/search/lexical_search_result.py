from uuid import UUID
from pydantic import BaseModel, ConfigDict


class LexicalSearchResult(BaseModel):
    candidate_uuid: UUID
    enrichment_profile_id: UUID
    lexical_score: float
    matched_fields: str

    model_config = ConfigDict(frozen=True)