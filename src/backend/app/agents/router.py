from backend.app.agents.state import ATSState


def route_after_planner(state: ATSState) -> str:
    """
    Planner -> Interaction / Retrieval
    """
    query_assessment = state.candidate_search.query_assessment
    
    # Defensive check nếu query_assessment chưa được khởi tạo
    if not query_assessment or not query_assessment.clarification:
        return "retrieval"

    clarification = query_assessment.clarification

    # Nếu cần làm rõ thông tin từ người dùng
    if clarification.status == "not_enough":
        return "interaction"

    return "retrieval"


def route_after_reflection(state: ATSState) -> str:
    """
    Reflection -> Planner (Thử lại) / RecruiterDecision (Chấp nhận)
    """
    reflection = state.candidate_search.reflection

    if reflection is None:
        return "recruiter"

    mission = state.candidate_search.mission

    # Guard chống vòng lặp vô hạn
    if reflection.retry and mission.retry_count < mission.max_retries and state.iteration < state.max_steps:
        return "planner"

    return "recruiter"