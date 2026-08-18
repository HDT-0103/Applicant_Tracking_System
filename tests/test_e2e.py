import asyncio
import json
import logging
import os
import sys
from collections.abc import Mapping
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT_DIR / "src"

for path in (SRC_DIR, ROOT_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def load_environment() -> None:
    env_path = ROOT_DIR / ".env"

    if load_dotenv is not None:
        load_dotenv(env_path, override=False)
    elif env_path.exists():
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)

    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if service_role_key and not os.getenv("SUPABASE_ANON_KEY"):
        os.environ["SUPABASE_ANON_KEY"] = service_role_key


load_environment()

from supabase import Client, create_client

from src.backend.app.agents.graph import build_graph
from src.backend.app.agents.nodes.interaction import CLIInteractionGateway
from src.backend.app.agents.state import (
    ATSState,
    CandidateSearchState,
    ClarificationDetail,
    Mission,
    MissionStatus,
    QueryAssessment,
)
from src.backend.app.repositories.candidate_search_repository import CandidateSearchRepository
from src.backend.app.repositories.enrichment_repository import EnrichmentRepository
from src.backend.app.services.candidate_search_service import CandidateSearchService
from src.backend.app.services.embedding_service import EmbeddingService
from src.backend.app.services.llm_provider import GroqProvider
from src.backend.app.services.ranking_service import RankingService


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("E2E_Test")


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def _state_value(state: object, key: str, default=None):
    if isinstance(state, Mapping):
        return state.get(key, default)
    return getattr(state, key, default)


def _as_dumpable(value: object):
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, list):
        return [_as_dumpable(item) for item in value]
    if isinstance(value, dict):
        return {key: _as_dumpable(item) for key, item in value.items()}
    return value


def init_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_role_key:
        raise ValueError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/environment."
        )

    return create_client(url, service_role_key)


def build_initial_state(user_prompt: str) -> ATSState:
    mission = Mission(
        objective=user_prompt,
        current_step="Initial Input",
        status=MissionStatus.PENDING,
        retry_count=0,
        max_retries=3,
    )

    query_assessment = QueryAssessment(
        original_query=user_prompt,
        clarification=ClarificationDetail(
            status="not_enough",
            missing_fields=[],
            question=None,
        ),
    )

    return ATSState(
        candidate_search=CandidateSearchState(
            mission=mission,
            query_assessment=query_assessment,
        ),
        messages=[user_prompt],
    )


async def run_e2e_test() -> None:
    print_section("BẮT ĐẦU KIỂM THỬ END-TO-END (E2E) AGENT SEARCH")
    logger.info("Đang khởi tạo repositories, services và graph...")

    supabase_client = init_supabase_client()

    search_repo = CandidateSearchRepository(supabase_client=supabase_client)
    enrichment_repo = EnrichmentRepository(session=supabase_client)

    embedding_service = EmbeddingService(model_name="intfloat/multilingual-e5-base")
    ranking_service = RankingService(
        w_lexical=0.2,
        w_sem_summary=0.4,
        w_sem_experience=0.4,
    )

    search_service = CandidateSearchService(
        search_repository=search_repo,
        enrichment_repository=enrichment_repo,
        embedding_service=embedding_service,
        ranking_service=ranking_service,
        min_similarity=0.5,
    )

    llm_provider = GroqProvider(model="llama-3.1-8b-instant")
    interaction_gateway = CLIInteractionGateway()

    app = build_graph(
        llm_provider=llm_provider,
        search_service=search_service,
        interaction_gateway=interaction_gateway,
    )

    user_prompt = (
        "Tôi cần tìm 2 bạn Senior Backend Developer thành thạo Python, FastAPI và "
        "PostgreSQL, làm việc tại TP.HCM."
    )
    initial_state = build_initial_state(user_prompt)

    print(f"📌 [User Query]: {user_prompt}\n")

    print_section("LUỒNG XỬ LÝ AGENT (GRAPH EXECUTION)")
    try:
        final_state = await app.ainvoke(initial_state)
    except Exception as exc:
        logger.error("Lỗi trong quá trình chạy Agent Graph: %s", exc, exc_info=True)
        return

    print_section("KẾT QUẢ CUỐI CÙNG (FINAL STATE)")

    candidate_state = _state_value(final_state, "candidate_search")
    if candidate_state is None:
        logger.error("Không nhận được candidate_search từ final_state.")
        return

    print("📜 [Action History]:")
    action_history = _state_value(candidate_state, "action_history", []) or []
    for index, action in enumerate(action_history, 1):
        node_name = _state_value(action, "node_name", "unknown")
        action_name = _state_value(action, "action", "unknown")
        decision = _state_value(action, "decision", None)
        print(f"  {index}. [{node_name}] {action_name}")
        if decision:
            print(f"     - Decision: {decision}")

    candidates = _state_value(candidate_state, "candidates", []) or []
    print(f"\n👥 [Candidates Retrieved]: {len(candidates)} ứng viên")
    for candidate in candidates:
        candidate_id = _state_value(candidate, "candidate_id", "unknown")
        semantic_score = _state_value(candidate, "semantic_score", 0.0)
        summary = _state_value(candidate, "summary", "")
        print(f"  - [{candidate_id}] Semantic Score: {semantic_score}")
        if summary:
            print(f"    Summary: {summary}")

    final_decision = _state_value(candidate_state, "final_decision")
    print("\n🎯 [Final Decision]:")
    if final_decision:
        print(json.dumps(_as_dumpable(final_decision), indent=2, ensure_ascii=False))
    else:
        print("  Không có quyết định cuối cùng.")

    print_section("HOÀN THÀNH BÀI TEST E2E")


if __name__ == "__main__":
    asyncio.run(run_e2e_test())