from datetime import datetime
import enum
from pydantic import Field
from pydantic import BaseModel
'''
Query -> Planner (Mission) -> Executor (ActionRecord) -> Result (Observation) -> Reflection (Decision) -> Next Action 
'''

class MissionStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ActionRecord(BaseModel):
    
    step: int
    
    node_name: str                  # Planner / Retrieve / Reflection...
    
    action: str                # DECIDE TO search_db, github_search...
    
    observation: dict | None = None     # Tool trả gì (tóm tắt)
    
    decision: str | None       # Reflection quyết định gì (nếu có)
    
    timestamp: datetime
    
class Mission(BaseModel):
    
    objective: str

    current_step: str

    status: MissionStatus

    retry_count: int
    
    plan: list[str] | None = None
    
    created_at: datetime
    
class CandidateSearchState(BaseModel):
    
    mission: Mission
    
    records: list[ActionRecord] = Field(default_factory=list)
    # placeholder for Candidate search results
    candidates: list[dict] = Field(default_factory=list)
    

    
class SchedulerState(BaseModel):
    
    mission: Mission
    
    records: list[ActionRecord] = Field(default_factory=list)

    
class ATSState(BaseModel):

    candidate_search: CandidateSearchState

    scheduler: SchedulerState

    iteration: int = 0

    messages: list[str] = Field(default_factory=list)

    