import pytest

from src.backend.app.services.score_aggregator import DEFAULT_WEIGHTS, ScoreAggregator


class TestScoreAggregator:

    def setup_method(self) -> None:
        self.aggregator = ScoreAggregator()

    def test_full_signals_returns_weighted_average(self) -> None:
        """1. Đầy đủ 3 tín hiệu: 0.3*0.8 + 0.5*0.9 + 0.2*1.0 = 0.24 + 0.45 + 0.20 = 0.89."""
        overall = self.aggregator.calculate_overall_score(
            summary_score=0.8,
            experience_score=0.9,
            github_score=1.0,
        )
        assert overall == 0.89

    def test_missing_github_reweights_remaining(self) -> None:
        """2. Thiếu GitHub (github_score = None):

        Tổng weight còn lại = 0.3 + 0.5 = 0.8.
        overall = (0.3*0.8 + 0.5*0.9) / 0.8 = (0.24 + 0.45) / 0.8 = 0.69 / 0.8 = 0.8625.
        """
        overall = self.aggregator.calculate_overall_score(
            summary_score=0.8,
            experience_score=0.9,
            github_score=None,
        )
        assert overall == 0.8625

    def test_zero_score_is_not_treated_as_none(self) -> None:
        """3. github_score = 0.0 (không phải None):

        Trọng số GitHub (0.2) VẪN TÍNH vào mẫu số.
        overall = (0.3*0.8 + 0.5*0.9 + 0.2*0.0) / 1.0 = 0.69.
        """
        overall = self.aggregator.calculate_overall_score(
            summary_score=0.8,
            experience_score=0.9,
            github_score=0.0,
        )
        assert overall == 0.69

    def test_only_github_signal(self) -> None:
        """4. Chỉ có mỗi GitHub (Summary & Experience là None):

        Trọng số chuẩn hóa = 0.2 / 0.2 = 1.0.
        overall = github_score = 0.75.
        """
        overall = self.aggregator.calculate_overall_score(
            summary_score=None,
            experience_score=None,
            github_score=0.75,
        )
        assert overall == 0.75

    def test_all_signals_missing_returns_none(self) -> None:
        """5. Tất cả tín hiệu bị None -> Trả về None."""
        overall = self.aggregator.calculate_overall_score(
            summary_score=None,
            experience_score=None,
            github_score=None,
        )
        assert overall is None