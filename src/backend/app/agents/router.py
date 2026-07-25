from backend.app.agents.state import ATSState


def route_after_planner(state: ATSState) -> str:
    """
    Planner
        ↓
    Interaction / Retrieval
    """

    clarification = (
        state.candidate_search
        .query_assessment
        .clarification_detail
    )

    if clarification.status == "not enough":
        return "interaction"

    return "retrieval"

from backend.app.agents.state import ATSState


def route_after_reflection(state: ATSState) -> str:
    """
    Reflection
        ↓
    Planner / RecruiterDecision
    """

    reflection = state.candidate_search.reflection

    if reflection is None:
        raise ValueError("Reflection not found.")

    if reflection.retry:
        return "recruiter"

    return "planner"