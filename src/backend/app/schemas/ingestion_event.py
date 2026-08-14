from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime, timezone
from enum import Enum

class IngestionEventType(str, Enum):
    INGESTION_QUEUED = "INGESTION_QUEUED"
    PARSING_STARTED = "PARSING_STARTED"
    PARSING_COMPLETE = "PARSING_COMPLETE"
    ANALYSIS_STARTED = "ANALYSIS_STARTED"
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE"
    EMBEDDING_STARTED = "EMBEDDING_STARTED"
    PERSISTENCE_COMPLETE = "PERSISTENCE_COMPLETE"
    AI_ANALYTICS_COMPLETE = "AI_ANALYTICS_COMPLETE"
    INGESTION_FAILED = "INGESTION_FAILED"

class IngestionEvent(BaseModel):
    type: IngestionEventType
    job_id: str
    resume_id: Optional[str] = None
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))