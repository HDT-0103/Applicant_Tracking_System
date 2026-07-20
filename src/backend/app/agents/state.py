from datetime import datetime
import enum
from typing_extensions import Literal, Any
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


class Mission(BaseModel):
    """
    Describe the overall goal of the current candidate search.
    """

    objective: str

    current_step: str

    status: MissionStatus = MissionStatus.PENDING

    retry_count: int = 0

    plan: list[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)



class ClarificationDetail(BaseModel):
    """
    Planner decides whether user query is sufficient.
    """

    status: Literal["enough", "not_enough"]

    missing_fields: list[str] = Field(default_factory=list)

    question: str | None = None


class QueryAssessment(BaseModel):
    """
    Planner's assessment of the recruiter query.
    """

    original_query: str

    clarification: ClarificationDetail


# =========================
# Execution
# =========================

class ToolCall(BaseModel):
    """
    Record every tool invocation.
    """

    tool_name: str

    tool_input: dict[str, Any]

    tool_output: dict[str, Any]

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Observation(BaseModel):
    """
    High-level summary after one execution.
    Reflection reads this instead of raw tool outputs.
    """

    summary: str

    metadata: dict[str, Any] = Field(default_factory=dict)

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ActionRecord(BaseModel):
    """
    Execution history for debugging.
    """

    step: int

    node_name: str

    action: str

    decision: str | None = None

    timestamp: datetime = Field(default_factory=datetime.utcnow)


# =========================
# Reflection
# =========================

class Reflection(BaseModel):
    """
    Reflection output after evaluating search quality.
    """

    retry: bool

    reason: str

    suggestion: str | None = None

#=========================
# Planner Input
#========================
class PlannerInput(BaseModel):

    user_query: str

    mission: Mission

    reflection: Reflection | None

    history: list[ActionRecord]


# =========================
# Planner Output
# =========================
class PlannerOutput(BaseModel):

    mission: Mission

    query_assessment: QueryAssessment

    reasoning: str

#========================
# Reflection Input
#========================
class ReflectionInput(BaseModel):
    
    mission: Mission

    history: list[ActionRecord]

    observation: Observation | None

#========================
# Reflection Output
#========================
class ReflectionOutput(BaseModel):

    reflection: Reflection

# =========================
# Candidate Search State
# =========================

class CandidateSearchState(BaseModel):

    mission: Mission

    query_assessment: QueryAssessment

    candidates: list[dict[str, Any]] = Field(default_factory=list)

    tool_calls: list[ToolCall] = Field(default_factory=list)

    observations: list[Observation] = Field(default_factory=list)

    reflection: Reflection | None = None

    action_history: list[ActionRecord] = Field(default_factory=list)

    final_decision: str | None = None

    
class SchedulerState(BaseModel):
    
    mission: Mission
    
    records: list[ActionRecord] = Field(default_factory=list)

    
class ATSState(BaseModel):

    candidate_search: CandidateSearchState

    scheduler: SchedulerState

    iteration: int = 0

    messages: list[str] = Field(default_factory=list)

    