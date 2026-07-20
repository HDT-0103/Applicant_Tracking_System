from backend.app.agents.state import CandidateSearchState, MissionStatus

def route_based_on_clarification(state: CandidateSearchState):
    """
    Route the state to the appropriate node based on the current mission status.
    """
    current_mission = state.candidate_search.mission
    
    if current_mission.clarification.status == "not enough":
        return "interaction_node"
    else:
        return "retrieval_node"
# code lại nốt cái này place holder cần đọc lại
def route_based_on_reflection(state: CandidateSearchState):
    """
    Route the state to the appropriate node based on the current mission status.
    """
    current_reflection = state.candidate_search.records[-1].observation if state.candidate_search.records else None

    if current_reflection.status == MissionStatus.COMPLETED:
        return "interaction_node"
    elif current_reflection.status == MissionStatus.FAILED:
        return "planner_node"
    else:
        raise ValueError(f"Unknown reflection status: {current_reflection.status}")