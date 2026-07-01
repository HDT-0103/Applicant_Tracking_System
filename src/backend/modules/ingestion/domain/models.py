from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class CandidateRecord(BaseModel):
    uuid: str
    full_name: Optional[str] = None
    github_username: Optional[str] = None
    linkedin_url: Optional[str] = None
    resume_text: Optional[str] = None
    status: str = "CREATED"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
