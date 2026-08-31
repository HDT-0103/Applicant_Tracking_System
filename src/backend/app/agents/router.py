from __future__ import annotations

from src.backend.app.agents.state import ATSState


def route_after_planner(state: ATSState) -> str:
    """Điều hướng sau Planner: Chuyển sang Interaction nếu thiếu thông tin, ngược lại sang Retrieval."""
    query_assessment = state.candidate_search.query_assessment

    if not query_assessment or not query_assessment.clarification:
        return "retrieval"

    clarification = query_assessment.clarification

    # Nếu cần làm rõ thông tin từ người dùng
    if clarification.status == "not_enough":
        return "interaction"

    return "retrieval"


def route_after_reflection(state: ATSState) -> str:
    """Điều hướng sau Reflection: Thử lại (Planner) hoặc Chấp nhận (RecruiterDecision)."""
    reflection = state.candidate_search.reflection

    if reflection is None:
        return "recruiter"

    mission = state.candidate_search.mission

    # Chống vòng lặp vô hạn
    if reflection.retry and mission.retry_count < mission.max_retries and state.iteration < state.max_steps:
        return "planner"

    return "recruiter"