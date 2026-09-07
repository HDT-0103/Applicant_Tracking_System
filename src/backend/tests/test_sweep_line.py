"""Sweep-line search for interview slots (U007).

This is the algorithm that decides which times a panel is collectively free.
A mistake here books an interview nobody attends, or hides the only window that
worked — and neither failure announces itself. It is pure logic with no I/O, so
it deserves table-driven coverage of the boundaries.

The interesting cases are all about edges: intervals that touch without
overlapping, a window exactly the minimum length, one interviewer with a gap in
the middle, and a panel where a single person is never free.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from modules.scheduling.application.sweep_line_service import SweepLineService
from modules.scheduling.domain.models import FreeBusyInterval

DAY = datetime(2026, 9, 1, tzinfo=timezone.utc)


def at(hour: float) -> datetime:
    """Clock time on the fixed test day: at(9.5) -> 09:30 UTC."""
    return DAY + timedelta(hours=hour)


def free(interviewer_id: str, start: float, end: float) -> FreeBusyInterval:
    return FreeBusyInterval(
        interviewer_id=interviewer_id, start_time=at(start), end_time=at(end)
    )


@pytest.fixture
def sweep() -> SweepLineService:
    return SweepLineService()


# ---------------------------------------------------------------------------
# Overlap detection
# ---------------------------------------------------------------------------

class TestOverlapDetection:
    def test_single_interviewer_free_all_morning(self, sweep):
        slots = sweep.find_slots({"a": [free("a", 9, 12)]}, min_slot_minutes=60)
        assert [(s.start_time, s.end_time) for s in slots] == [
            (at(9), at(10)),
            (at(10), at(11)),
            (at(11), at(12)),
        ]

    def test_two_interviewers_only_their_intersection_counts(self, sweep):
        # a: 09-12, b: 11-14  ->  panel is free 11-12 only
        slots = sweep.find_slots(
            {"a": [free("a", 9, 12)], "b": [free("b", 11, 14)]},
            min_slot_minutes=60,
        )
        assert [(s.start_time, s.end_time) for s in slots] == [(at(11), at(12))]

    def test_no_intersection_yields_nothing(self, sweep):
        slots = sweep.find_slots(
            {"a": [free("a", 9, 10)], "b": [free("b", 14, 15)]},
            min_slot_minutes=60,
        )
        assert slots == []

    def test_touching_intervals_do_not_overlap(self, sweep):
        # a ends exactly when b starts. There is no instant both are free.
        # Off-by-one here would invent a zero-length window.
        slots = sweep.find_slots(
            {"a": [free("a", 9, 11)], "b": [free("b", 11, 13)]},
            min_slot_minutes=30,
        )
        assert slots == []

    def test_one_interviewer_never_free_blocks_the_panel(self, sweep):
        slots = sweep.find_slots(
            {"a": [free("a", 9, 17)], "b": [free("b", 9, 17)], "c": []},
            min_slot_minutes=60,
        )
        assert slots == []

    def test_gap_in_the_middle_splits_the_window(self, sweep):
        # b is free 09-10 and 11-12, busy in between.
        slots = sweep.find_slots(
            {"a": [free("a", 9, 12)], "b": [free("b", 9, 10), free("b", 11, 12)]},
            min_slot_minutes=60,
        )
        assert [(s.start_time, s.end_time) for s in slots] == [
            (at(9), at(10)),
            (at(11), at(12)),
        ]

    def test_three_interviewers_need_all_three(self, sweep):
        slots = sweep.find_slots(
            {
                "a": [free("a", 9, 17)],
                "b": [free("b", 10, 12)],
                "c": [free("c", 11, 16)],
            },
            min_slot_minutes=60,
        )
        assert [(s.start_time, s.end_time) for s in slots] == [(at(11), at(12))]


# ---------------------------------------------------------------------------
# Minimum-length filtering
# ---------------------------------------------------------------------------

class TestMinimumLength:
    def test_window_shorter_than_the_minimum_is_dropped(self, sweep):
        # 30 minutes of overlap cannot host a 45-minute interview.
        slots = sweep.find_slots(
            {"a": [free("a", 9, 10)], "b": [free("b", 9.5, 10)]},
            min_slot_minutes=45,
        )
        assert slots == []

    def test_window_exactly_the_minimum_is_kept(self, sweep):
        # Boundary: `<=` vs `<` decides whether this survives.
        slots = sweep.find_slots(
            {"a": [free("a", 9, 9.75)]}, min_slot_minutes=45
        )
        assert len(slots) == 1
        assert slots[0].duration_min == 45

    def test_long_window_is_chopped_into_back_to_back_slots(self, sweep):
        slots = sweep.find_slots({"a": [free("a", 9, 12)]}, min_slot_minutes=45)
        assert len(slots) == 4  # 45 x 4 = 180 minutes
        for earlier, later in zip(slots, slots[1:]):
            assert earlier.end_time <= later.start_time, "slots must not overlap"

    def test_remainder_too_short_to_fill_is_not_emitted(self, sweep):
        # 100 minutes at 45 each leaves 10 minutes, which is not a slot.
        slots = sweep.find_slots(
            {"a": [free("a", 9, 9 + 100 / 60)]}, min_slot_minutes=45
        )
        assert len(slots) == 2
        assert all(s.duration_min == 45 for s in slots)


# ---------------------------------------------------------------------------
# Empty and degenerate input
# ---------------------------------------------------------------------------

class TestDegenerateInput:
    def test_no_interviewers_at_all(self, sweep):
        assert sweep.find_slots({}) == []

    def test_every_interviewer_has_no_availability(self, sweep):
        assert sweep.find_slots({"a": [], "b": []}) == []

    def test_zero_length_interval_produces_nothing(self, sweep):
        assert sweep.find_slots({"a": [free("a", 9, 9)]}, min_slot_minutes=45) == []


# ---------------------------------------------------------------------------
# Shape of the result
# ---------------------------------------------------------------------------

class TestResultShape:
    def test_every_slot_lists_the_whole_panel(self, sweep):
        slots = sweep.find_slots(
            {"a": [free("a", 9, 12)], "b": [free("b", 9, 12)]},
            min_slot_minutes=60,
        )
        assert all(sorted(s.interviewer_ids) == ["a", "b"] for s in slots)

    def test_interviewer_ids_are_ordered_deterministically(self, sweep):
        """Two identical calls must return identical payloads.

        Built from a set, the order varies between runs. That makes API
        responses unstable, breaks response caching and turns any assertion on
        the field into a flaky test.
        """
        panel = {name: [free(name, 9, 11)] for name in ("delta", "alpha", "charlie")}
        first = sweep.find_slots(panel, min_slot_minutes=60)
        second = sweep.find_slots(panel, min_slot_minutes=60)
        assert [s.interviewer_ids for s in first] == [s.interviewer_ids for s in second]
        assert first[0].interviewer_ids == sorted(first[0].interviewer_ids)

    def test_slots_are_returned_in_chronological_order(self, sweep):
        slots = sweep.find_slots({"a": [free("a", 9, 13)]}, min_slot_minutes=60)
        assert slots == sorted(slots, key=lambda s: s.start_time)

    def test_limit_caps_the_number_of_slots(self, sweep):
        """`limit` is part of the signature, so it has to mean something.

        A whole free day at 45 minutes a slot is over a dozen options; handing
        all of them to the UI as "suggestions" is not a suggestion.
        """
        slots = sweep.find_slots(
            {"a": [free("a", 9, 17)]}, min_slot_minutes=45, limit=3
        )
        assert len(slots) == 3

    def test_duration_is_reported_in_minutes(self, sweep):
        slots = sweep.find_slots({"a": [free("a", 9, 10)]}, min_slot_minutes=60)
        assert slots[0].duration_min == 60


class TestStartTimeStep:
    """`step_minutes` là bước giữa hai gợi ý giờ bắt đầu — tách khỏi độ dài khe.

    Trang lịch muốn HR chọn được 9:15 chứ không chỉ 9:00/9:45 (bước 15 phút,
    khe chồng nhau). Nhưng mặc định vẫn phải là các khe nối tiếp: đây là hành
    vi mọi test khác dựa vào, và một lần "đổi hằng số" từng làm cả bộ test đỏ.
    """

    def test_default_step_equals_the_slot_length_so_slots_do_not_overlap(self, sweep):
        slots = sweep.find_slots({"a": [free("a", 9, 12)]}, min_slot_minutes=45)
        assert [s.start_time for s in slots] == [at(9), at(9.75), at(10.5), at(11.25)]

    def test_a_15_minute_step_offers_every_quarter_hour_and_still_respects_limit(self, sweep):
        slots = sweep.find_slots({"a": [free("a", 9, 12)]}, min_slot_minutes=45, step_minutes=15, limit=0)
        assert [s.start_time for s in slots][:4] == [at(9), at(9.25), at(9.5), at(9.75)]
        assert all(s.duration_min == 45 for s in slots)
        assert slots[-1].end_time <= at(12)
        assert len(sweep.find_slots({"a": [free("a", 9, 12)]}, min_slot_minutes=45, step_minutes=15, limit=3)) == 3
