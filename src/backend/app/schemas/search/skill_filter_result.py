from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SkillFilterResult(BaseModel):
    candidate_uuid: UUID

    model_config = ConfigDict(frozen=True)