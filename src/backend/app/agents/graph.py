from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from src.backend.app.agents.nodes.interaction import HumanInteractionGateway, InteractionNode
from src.backend.app.agents.nodes.planner import PlannerNode
from src.backend.app.agents.nodes.recruiter_decision import RecruiterDecisionNode
from src.backend.app.agents.nodes.reflection import ReflectionNode
from src.backend.app.agents.nodes.retrieval import RetrievalNode
from src.backend.app.agents.router import route_after_planner, route_after_reflection
from src.backend.app.agents.state import ATSState
from src.backend.app.services.candidate_search_service import CandidateSearchService
from src.backend.app.services.llm_provider import LLMProvider


def build_graph(
    llm_provider: LLMProvider,
    search_service: CandidateSearchService,
    interaction_gateway: HumanInteractionGateway,
) -> CompiledStateGraph:
    """Khởi tạo và compile Agent Graph với các dependencies được inject vào."""
    # 1. Instantiating Nodes
    planner_node = PlannerNode(llm_provider=llm_provider)
    interaction_node = InteractionNode(gateway=interaction_gateway)
    retrieval_node = RetrievalNode(search_service=search_service)
    reflection_node = ReflectionNode(llm_provider=llm_provider)
    recruiter_node = RecruiterDecisionNode(llm_provider=llm_provider)

    # 2. Build State Graph
    workflow = StateGraph(ATSState)

    # Add Nodes
    workflow.add_node("planner", planner_node.execute)
    workflow.add_node("interaction", interaction_node.execute)
    workflow.add_node("retrieval", retrieval_node.execute)
    workflow.add_node("reflection", reflection_node.execute)
    workflow.add_node("recruiter", recruiter_node.execute)

    # Add Edges
    workflow.add_edge(START, "planner")

    workflow.add_conditional_edges(
        "planner",
        route_after_planner,
        {
            "interaction": "interaction",
            "retrieval": "retrieval",
        },
    )

    workflow.add_edge("interaction", "planner")
    workflow.add_edge("retrieval", "reflection")

    workflow.add_conditional_edges(
        "reflection",
        route_after_reflection,
        {
            "planner": "planner",
            "recruiter": "recruiter",
        },
    )

    workflow.add_edge("recruiter", END)

    return workflow.compile()