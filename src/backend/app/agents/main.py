import asyncio
from backend.app.services.llm_provider import GroqProvider
from backend.app.services.candidate_search_service import CandidateSearchService
from backend.app.agents.nodes.interaction import CLIInteractionGateway
from backend.app.agents.graph import build_graph
from backend.app.agents.state import ATSState, CandidateSearchState

async def main():
    # 1. Setup Dependencies
    llm_provider = GroqProvider()
    search_service = CandidateSearchService(...)  # Inject repos/services
    cli_gateway = CLIInteractionGateway()

    # 2. Build Graph
    app = build_graph(
        llm_provider=llm_provider,
        search_service=search_service,
        interaction_gateway=cli_gateway
    )

    # 3. Initial State
    initial_state = ATSState(
        messages=["Tìm cho tôi Senior Python Developer có kinh nghiệm FastAPI"],
        candidate_search=CandidateSearchState()
    )

    # 4. Execute Graph
    final_state = await app.ainvoke(initial_state)
    print("\n--- DONE ---")
    print("Final Decision:", final_state["candidate_search"].final_decision)

if __name__ == "__main__":
    asyncio.run(main())