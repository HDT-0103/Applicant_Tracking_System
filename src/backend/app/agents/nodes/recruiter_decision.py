import asyncio

from src.backend.app.agents.nodes.base import BaseNode
from src.backend.app.agents.state import (
    ATSState,
    CandidateContext,
    CandidateRecommendation,
    RecruiterDecisionInput,
    RecruiterDecisionOutput,
)
from src.backend.app.services.llm_provider import LLMProvider


class RecruiterDecisionNode(BaseNode):
    batch_size = 2
    history_limit = 3

    @staticmethod
    def _candidate_code(candidate_id: str) -> str:
        return candidate_id[-4:].upper()

    @classmethod
    def _normalize_recommendation(
        cls,
        recommendation: CandidateRecommendation,
        candidates_by_id: dict[str, CandidateContext],
    ) -> CandidateRecommendation:
        candidate = candidates_by_id.get(recommendation.candidate_id)
        full_name = (candidate.full_name if candidate else None) or "Ứng viên"
        code = cls._candidate_code(recommendation.candidate_id)
        return recommendation.model_copy(
            update={
                "candidate_code": code,
                "full_name": full_name,
                "display_name": f"{full_name} (#{code})",
            }
        )

    @staticmethod
    def _compact_candidate(candidate: CandidateContext) -> CandidateContext:
        return candidate.model_copy(
            update={
                "summary": candidate.summary[:400],
                "skills": candidate.skills[:8],
                "strengths": candidate.strengths[:8],
                "weaknesses": candidate.weaknesses[:6],
                "experiences": [
                    experience.model_copy(
                        update={
                            "company": experience.company[:100],
                            "position": experience.position[:100],
                            "duration": experience.duration[:50],
                            "highlights": [highlight[:180] for highlight in experience.highlights[:2]],
                        }
                    )
                    for experience in candidate.experiences[:3]
                ],
                "github_summary": (
                    candidate.github_summary[:400]
                    if candidate.github_summary
                    else None
                ),
                "linkedin_summary": (
                    candidate.linkedin_summary[:400]
                    if candidate.linkedin_summary
                    else None
                ),
            }
        )

    @staticmethod
    def _compact_mission(mission):
        return mission.model_copy(
            update={
                "objective": mission.objective[:1000],
                "plan": [step[:160] for step in mission.plan[:5]],
            }
        )

    @staticmethod
    def _compact_history(history):
        return [
            action.model_copy(
                update={
                    "action": action.action[:160],
                    "decision": action.decision[:300] if action.decision else None,
                }
            )
            for action in history
        ]

    def __init__(self, llm_provider: LLMProvider):
        super().__init__()
        self.llm_provider = llm_provider

    async def execute(self, state: ATSState) -> ATSState:
        recruiter_prompt = self.load_prompt("prompts/recruiter_prompt.md")

        if not state.candidate_search.candidates:
            state.candidate_search.final_decision = RecruiterDecisionOutput(
                candidates=[],
                summary="No candidates were returned by the retrieval pipeline.",
            )
            self.record_action(
                state=state,
                action="Synthesize recruiter recommendation",
                decision=state.candidate_search.final_decision.final_summary,
            )
            return state
        
        # Evaluate small batches so one large candidate set cannot exceed the
        # provider's per-request or tokens-per-minute budget.
        candidates = [
            self._compact_candidate(candidate)
            for candidate in state.candidate_search.candidates
        ]
        mission = self._compact_mission(state.candidate_search.mission)
        history = self._compact_history(
            state.candidate_search.action_history[-self.history_limit :]
        )
        recommendations: list[CandidateRecommendation] = []

        for start in range(0, len(candidates), self.batch_size):
            decision_input = RecruiterDecisionInput(
                mission=mission,
                candidates=candidates[start : start + self.batch_size],
                history=history,
            )
            batch_output = await asyncio.to_thread(
                self.llm_provider.invoke,
                recruiter_prompt,
                decision_input,
                RecruiterDecisionOutput,
            )
            recommendations.extend(
                self._normalize_recommendation(item, {candidate.candidate_id: candidate for candidate in candidates})
                for item in batch_output.candidates
            )

        recommendations.sort(key=lambda item: item.confidence, reverse=True)
        top_recommendations = recommendations[:5]
        recommendation_summary = "; ".join(
            f"{item.display_name}: {item.recommendation} ({item.confidence:.0%})"
            for item in top_recommendations
        )
        decision_output = RecruiterDecisionOutput(
            candidates=recommendations,
            summary=(
                f"Evaluated {len(candidates)} candidates in "
                f"{(len(candidates) + self.batch_size - 1) // self.batch_size} batches. "
                f"Top matches: {recommendation_summary or 'No recommendations returned.'}"
            ),
        )

        # 3. Update state
        state.candidate_search.final_decision = decision_output
        
        # 4. Record history
        self.record_action(
            state=state,
            action=decision_input.mission.current_step,
            decision=decision_output.final_summary
        )
        
        return state