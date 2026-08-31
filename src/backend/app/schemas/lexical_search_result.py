from uuid import UUID
from pydantic import BaseModel, ConfigDict

class LexicalSearchResult(BaseModel):
    candidate_uuid: str
    enrichment_profile_id: UUID
    lexical_score: float
    matched_fields: list[str]

    model_config = ConfigDict(from_attributes=True)