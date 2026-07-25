from langgraph.graph import StateGraph, START, END
from .state import ATSState
from src.backend.app.agents.nodes.planner import PlannerNode
from src.backend.app.agents.nodes.interaction import InteractionNode
from src.backend.app.agents.nodes.retrieval import RetrievalNode
from src.backend.app.agents.nodes.reflection import ReflectionNode
from src.backend.app.agents.nodes.recruiter_decision import RecruiterDecisionNode

from src.backend.app.agents.router import route_after_planner, route_after_reflection

from src.backend.app.services.llm_provider import GroqProvider

llm_provider = GroqProvider()

planner_node = PlannerNode(llm_provider)
interaction_node = InteractionNode(llm_provider)
retrieval_node = RetrievalNode(llm_provider)
reflection_node = ReflectionNode(llm_provider)
recruiter_node = RecruiterDecisionNode(llm_provider)


workflow = StateGraph(ATSState)

workflow.add_node(
    "planner",
    planner_node.execute
)

workflow.add_node(
    "interaction",
    interaction_node.execute
)

workflow.add_node(
    "retrieval",
    retrieval_node.execute
)

workflow.add_node(
    "reflection",
    reflection_node.execute
)

workflow.add_node(
    "recruiter",
    recruiter_node.execute
)

workflow.add_edge(
    START,
    "planner"
)

workflow.add_conditional_edges(

    "planner",

    route_after_planner,

    {

        "interaction": "interaction",

        "retrieval": "retrieval"

    }

)

workflow.add_edge(

    "interaction",

    "planner"

)

workflow.add_edge(

    "retrieval",

    "reflection"

)

workflow.add_conditional_edges(

    "reflection",

    route_after_reflection,

    {

        "planner": "planner",

        "recruiter": "recruiter"

    }

)

workflow.add_edge(

    "recruiter",

    END

)

graph = workflow.compile()