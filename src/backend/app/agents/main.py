import asyncio
from datetime import datetime

from src.backend.app.agents.graph import build_graph
from src.backend.app.agents.nodes.interaction import CLIInteractionGateway
from src.backend.app.agents.state import (
    ATSState,
    CandidateSearchState,
    Mission,
    MissionStatus,
)
from src.backend.app.services.candidate_search_service import CandidateSearchService
from src.backend.app.services.llm_provider import GroqProvider


async def main() -> None:
    # 1. Setup Dependencies
    llm_provider = GroqProvider()
    # Inject Repositories/Services thực tế vào đây
    search_service = CandidateSearchService(...)  
    cli_gateway = CLIInteractionGateway()

    # 2. Build Graph
    app = build_graph(
        llm_provider=llm_provider,
        search_service=search_service,
        interaction_gateway=cli_gateway,
    )

    # 3. Initial State (Tạo Mission ban đầu để không bị lỗi Pydantic)
    user_query = "Tìm cho tôi Senior Python Developer có kinh nghiệm FastAPI"
    
    initial_mission = Mission(
        objective=user_query,
        current_step="Planner Assessment",
        status=MissionStatus.PENDING,
    )

    initial_state = ATSState(
        messages=[user_query],
        candidate_search=CandidateSearchState(
            mission=initial_mission,
        ),
    )

    # 4. Execute Graph
    final_state = await app.ainvoke(initial_state)
    print("\n--- DONE ---")
    if final_state["candidate_search"].final_decision:
        print("Final Decision:", final_state["candidate_search"].final_decision.final_summary)


if __name__ == "__main__":
    asyncio.run(main())