from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS: dict[str, float] = {
    "summary": 0.30,
    "experience": 0.50,
    "github": 0.20,
}


class ScoreAggregator:
    """Service chịu trách nhiệm tổng hợp các component scores thành overall_score

    sử dụng chiến lược Dynamic Re-weighting khi bị khuyết tín hiệu (score is None).
    """

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = weights if weights is not None else DEFAULT_WEIGHTS.copy()

    def calculate_overall_score(
        self,
        summary_score: float | None,
        experience_score: float | None,
        github_score: float | None,
    ) -> float | None:
        """Tính overall_score dựa trên các điểm thành phần.

        - Tự động chuẩn hóa lại trọng số (Re-weighting) nếu có score == None.
        - Giữ nguyên trọng số nếu score == 0.0.
        - Trả về None nếu tất cả score đều == None.
        """
        scores: dict[str, float | None] = {
            "summary": summary_score,
            "experience": experience_score,
            "github": github_score,
        }

        available_weights_sum = 0.0
        weighted_score_sum = 0.0

        for key, score in scores.items():
            if score is not None:
                w = self.weights.get(key, 0.0)
                available_weights_sum += w
                weighted_score_sum += w * score

        # Nếu không có bất kỳ tín hiệu nào (tất cả đều None hoặc weight = 0)
        if available_weights_sum == 0.0:
            logger.info("No available component scores to aggregate. Returning None.")
            return None

        # Re-weighted overall score
        overall = weighted_score_sum / available_weights_sum
        return round(float(overall), 4)