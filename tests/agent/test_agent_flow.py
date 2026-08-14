import asyncio
from typing import Any
from pydantic import BaseModel

from src.backend.app.agents.graph import build_graph
from src.backend.app.agents.nodes.interaction import HumanInteractionGateway
from src.backend.app.agents.state import (
    ATSState,
    CandidateContext,
    CandidateRecommendation,
    CandidateSearchState,
    ClarificationDetail,
    ExperienceContext,
    HardFilter,
    Mission,
    MissionStatus,
    PlannerOutput,
    QueryAssessment,
    RecruiterDecisionOutput,
    Reflection,
    ReflectionOutput,
    SearchRequirement,
    SoftQuery,
)
from src.backend.app.services.llm_provider import LLMProvider


# ==========================================================
# 1. MOCK SERVICES & PROVIDERS
# ==========================================================

class MockLLMProvider(LLMProvider):
    """LLM Provider giả lập không tốn API key, trả về dữ liệu chuẩn theo Pydantic Model."""

    def invoke(
        self,
        system_prompt: str,
        user_input: Any,
        response_model: type[BaseModel] | None = None,
        temperature: float = 0.1,
    ) -> Any:
        # Giả lập phản hồi của Planner
        if response_model == PlannerOutput:
            return PlannerOutput(
                mission=Mission(
                    objective="Tìm Senior Python Developer",
                    current_step="Execute Candidate Retrieval",
                    status=MissionStatus.IN_PROGRESS,
                ),
                query_assessment=QueryAssessment(
                    original_query="Tìm Senior Python Developer",
                    clarification=ClarificationDetail(
                        status="enough",
                        missing_fields=[],
                        question=None,
                    ),
                ),
                search_requirement=SearchRequirement(
                    hard_filter=HardFilter(skills=["Python"]),
                    soft_query=SoftQuery(
                        summary="Senior Python Developer with FastAPI and Microservices experience",
                        experience="> 3 years of Python development",
                    ),
                ),
                reasoning="Query is clear and complete. Extracted hard filters and soft requirements.",
            )

        # Giả lập phản hồi của Reflection
        elif response_model == ReflectionOutput:
            return ReflectionOutput(
                reflection=Reflection(
                    retry=False,
                    reason="Retrieved candidates closely match the Python & FastAPI requirements.",
                    suggestion="Proceed to recruiter decision.",
                )
            )

        # Giả lập phản hồi của Recruiter Decision
        elif response_model == RecruiterDecisionOutput:
            return RecruiterDecisionOutput(
                recommendations=[
                    CandidateRecommendation(
                        candidate_id="cand_001",
                        recommendation="Strong Hire",
                        confidence=0.95,
                        reasoning="Strong experience in Python, FastAPI, and scalable architecture.",
                        key_strengths=["FastAPI", "PostgreSQL", "Docker"],
                        missing_requirements=[],
                        risks=[],
                    )
                ],
                final_summary="Found 1 top candidate matching all requirements perfectly.",
            )

        return "Mock plain text response"


class MockCandidateSearchService:
    """Service giả lập tìm kiếm ứng viên."""

    async def search(self, requirement: Any, top_k: int = 10) -> list[CandidateContext]:
        return [
            CandidateContext(
                candidate_id="cand_001",
                semantic_score=0.92,
                summary="Senior Python Backend Engineer with 5 years experience.",
                skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
                strengths=["System Architecture", "API Design"],
                weaknesses=[],
                experiences=[
                    ExperienceContext(
                        company="Tech Corp",
                        position="Senior Developer",
                        duration="2021 - Present",
                        highlights=["Built high-throughput FastAPI services"],
                    )
                ],
            )
        ]


class MockInteractionGateway(HumanInteractionGateway):
    """Gateway giả lập giao tiếp với recruiter."""

    async def ask(self, question: str) -> str:
        return "Tôi cần ứng viên ở TP.HCM"


# ==========================================================
# 2. RUNNER SCRIPT
# ==========================================================

async def run_test():
    print("🚀 ===== BẮT ĐẦU TEST AGENT GRAPH =====")

    # 1. Khởi tạo Dependencies (dùng Mock)
    llm_provider = MockLLMProvider()
    search_service = MockCandidateSearchService()
    interaction_gateway = MockInteractionGateway()

    # 2. Build Graph
    print("📦 Building Agent Graph...")
    app = build_graph(
        llm_provider=llm_provider,
        search_service=search_service,  # type: ignore
        interaction_gateway=interaction_gateway,
    )

    # 3. Tạo Initial State
    user_query = "Tìm cho tôi Senior Python Developer kinh nghiệm FastAPI"
    initial_state = ATSState(
        messages=[user_query],
        candidate_search=CandidateSearchState(
            mission=Mission(
                objective=user_query,
                current_step="Initial Assessment",
                status=MissionStatus.PENDING,
            )
        ),
    )

    # 4. Thực thi Agent Graph
    print(f"🤖 Invoking Graph với query: '{user_query}'\n")
    final_state = await app.ainvoke(initial_state)

    # 5. Kiểm tra kết quả
    candidate_search = final_state["candidate_search"]
    decision = candidate_search.final_decision

    print("=" * 50)
    print("📊 ===== KẾT QUẢ KIỂM TRA =====")
    print(f"✅ Step tổng cộng: {final_state['iteration']}")
    print(f"✅ Mission Status: {candidate_search.mission.status}")
    print(f"✅ Số lượng candidates lấy được: {len(candidate_search.candidates)}")
    print(f"✅ Action History ({len(candidate_search.action_history)} bước):")
    
    for action in candidate_search.action_history:
        print(f"   [Step {action.step}] Node: {action.node_name:<22} | Action: {action.action}")

    print("\n🏆 ===== KHUYẾN NGHỊ CUỐI CÙNG (RECRUITER DECISION) =====")
    if decision:
        print(f"Summary: {decision.final_summary}\n")
        for rec in decision.recommendations:
            print(f"• Candidate ID: {rec.candidate_id}")
            print(f"  - Decision    : {rec.recommendation} (Confidence: {rec.confidence * 100:.0f}%)")
            print(f"  - Reasoning   : {rec.reasoning}")
            print(f"  - Key Strengths: {', '.join(rec.key_strengths)}")
    else:
        print("❌ Không nhận được kết quả Recruiter Decision!")

    print("\n🎉 ===== TEST PASSED THÀNH CÔNG! =====")


if __name__ == "__main__":
    asyncio.run(run_test())