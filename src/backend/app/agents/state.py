from __future__ import annotations

import enum
from datetime import datetime
from typing import Any
from typing_extensions import Literal

from pydantic import BaseModel, Field

"""
==========================================================
ATS Agent State

Flow:

Recruiter Query
        │
        ▼
Planner
        │
        ├── Clarification
        │
        └── Search Requirement
                │
                ▼
Retrieval
                │
                ▼
Candidate Context
                │
                ▼
Reflection
                │
                ▼
Recruiter Decision
==========================================================
"""

# ==========================================================
# Mission
# ==========================================================


class MissionStatus(str, enum.Enum):
    """Current execution status of the search mission."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Mission(BaseModel):
    """
    High-level objective of the current search session.

    This object survives through every node.
    """

    objective: str

    current_step: str

    status: MissionStatus = MissionStatus.PENDING

    retry_count: int = 0

    max_retries: int = 3

    plan: list[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================================
# Planner Output
# ==========================================================


class ClarificationDetail(BaseModel):
    """
    Whether recruiter query is sufficient.
    """

    status: Literal["enough", "not_enough"]

    missing_fields: list[str] = Field(default_factory=list)

    question: str | None = None


class QueryAssessment(BaseModel):
    """
    Planner assessment for current recruiter query.
    """

    original_query: str

    clarification: ClarificationDetail


# ==========================================================
# Search Requirement
# ==========================================================


class HardFilter(BaseModel):
    """
    Exact filters executed BEFORE semantic search.

    All fields are optional.
    """

    skills: list[str] = Field(default_factory=list)

    locations: list[str] = Field(default_factory=list)

    universities: list[str] = Field(default_factory=list)

    education_levels: list[str] = Field(default_factory=list)


class SoftQuery(BaseModel):
    """
    Natural language requirements.

    These fields are embedded and used for
    lexical search + semantic search.
    """

    summary: str

    experience: str

    github: str | None = None

    linkedin: str | None = None


class SearchRequirement(BaseModel):
    """
    Planner decomposes recruiter query into:

    - Hard Filter
    - Soft Matching
    """

    hard_filter: HardFilter

    soft_query: SoftQuery


# ==========================================================
# Execution History
# ==========================================================


class ToolCall(BaseModel):
    """
    Raw tool execution log.
    Mainly used for debugging.
    """

    tool_name: str

    tool_input: dict[str, Any]

    tool_output: dict[str, Any]

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ActionRecord(BaseModel):
    """
    High-level execution history.

    Used for Planner and Reflection.
    """

    step: int

    node_name: str

    action: str

    decision: str | None = None

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Observation(BaseModel):
    """
    High-level summary after one node execution.

    Reflection only reads Observation,
    instead of raw tool outputs.
    """

    node: str

    summary: str

    metadata: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================================
# Reflection
# ==========================================================


class Reflection(BaseModel):
    """
    Reflection result after Retrieval.

    Decide whether another iteration is needed.
    """

    retry: bool

    reason: str

    suggestion: str | None = None


# ==========================================================
# Planner IO
# ==========================================================


class PlannerInput(BaseModel):
    """
    Input sent into Planner LLM.
    """

    user_query: str

    mission: Mission

    reflection: Reflection | None

    history: list[ActionRecord]


class PlannerOutput(BaseModel):
    """
    Planner returns:

    - Updated mission
    - Query assessment
    - Search requirement
    """

    mission: Mission

    query_assessment: QueryAssessment

    search_requirement: SearchRequirement

    reasoning: str


# ==========================================================
# Reflection IO
# ==========================================================


class ReflectionInput(BaseModel):

    mission: Mission

    history: list[ActionRecord]

    observation: Observation | None


class ReflectionOutput(BaseModel):

    reflection: Reflection


# ==========================================================
# Candidate Context
# ==========================================================


class ExperienceContext(BaseModel):
    """
    Structured work experience used
    by Recruiter Decision.
    """

    company: str

    position: str

    duration: str

    highlights: list[str]


class CandidateContext(BaseModel):
    """
    Candidate returned by Retrieval.

    This is NOT raw database row.

    It is an AI-friendly object.
    """

    candidate_id: str

    semantic_score: float

    summary: str

    skills: list[str]

    strengths: list[str]

    weaknesses: list[str]

    experiences: list[ExperienceContext]

    github_summary: str | None = None

    linkedin_summary: str | None = None


# ==========================================================
# Recruiter Decision
# ==========================================================


class RecruiterDecisionInput(BaseModel):

    mission: Mission

    candidates: list[CandidateContext]

    history: list[ActionRecord]


class CandidateRecommendation(BaseModel):

    candidate_id: str

    recommendation: Literal[
        "Strong Hire",
        "Hire",
        "Consider",
        "Reject",
    ]

    confidence: float

    reasoning: str

    key_strengths: list[str]

    missing_requirements: list[str]

    risks: list[str]


class RecruiterDecisionOutput(BaseModel):

    recommendations: list[CandidateRecommendation]

    final_summary: str


# ==========================================================
# Candidate Search State
# ==========================================================


class CandidateSearchState(BaseModel):
    """Runtime state for Candidate Search Agent."""

    # Mission management
    mission: Mission

    # Query quality (Cho phép None khi bắt đầu, Planner sẽ điền sau)
    query_assessment: QueryAssessment | None = None

    # Planner decomposition result
    search_requirement: SearchRequirement | None = None

    # Retrieval output
    candidates: list[CandidateContext] = Field(default_factory=list)

    # Node summaries
    observations: list[Observation] = Field(default_factory=list)

    # Reflection result
    reflection: Reflection | None = None

    # Final recruiter recommendation
    final_decision: RecruiterDecisionOutput | None = None

    # Execution history
    action_history: list[ActionRecord] = Field(default_factory=list)


# ==========================================================
# Root Graph State
# ==========================================================


class ATSState(BaseModel):
    """
    Shared LangGraph state.
    """

    candidate_search: CandidateSearchState

    iteration: int = 0

    max_steps: int = 20

    messages: list[str] = Field(default_factory=list)