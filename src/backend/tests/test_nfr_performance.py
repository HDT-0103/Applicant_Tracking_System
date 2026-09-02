"""Đo các ràng buộc phi chức năng mà SRS đã cam kết bằng con số.

SRS (Template1 §3.2.2) đặt hơn hai mươi ngưỡng có số cụ thể, nhưng trước đây
không có phép đo nào — nghĩa là không ai biết hệ thống có đạt hay không, và
câu trả lời cho "150ms là đo bằng gì?" chỉ là im lặng.

## Đọc kết quả cho đúng

Đây là test HIỆU NĂNG chạy trên máy phát triển, không phải trên môi trường
thật. Chúng chỉ khẳng định được một điều: thuật toán không có lỗi về ĐỘ PHỨC
TẠP làm nó chậm hơn ngưỡng hàng bậc. Chúng KHÔNG chứng minh được độ trễ khi
có tải thật, mạng thật, hay cơ sở dữ liệu thật.

Vì vậy mọi thứ chạm mạng đều bị loại khỏi phép đo (Google Calendar, Supabase,
Azure): thời gian của bên thứ ba không phải thứ mã nguồn này kiểm soát, và
trộn nó vào sẽ biến test thành hay hỏng vặt.

Ngưỡng để rộng hơn SRS một chút ở chỗ có ý nghĩa, và ghi rõ hệ số — mục đích
là bắt hồi quy về độ phức tạp, không phải để đỏ mỗi khi máy CI bận.
"""
from __future__ import annotations

import statistics
import time
from datetime import datetime, timedelta, timezone

import pytest

from modules.scheduling.application.sweep_line_service import SweepLineService
from modules.scheduling.domain.models import FreeBusyInterval
from modules.shared.infrastructure.abac import apply_abac

#: Chạy nhiều lần rồi lấy TRUNG VỊ. Lần đầu luôn đắt hơn (nạp module, làm nóng
#: cache CPU), và một lần đo đơn lẻ trên máy dùng chung thì nhiễu quá lớn.
REPEATS = 25


def _median_ms(fn, repeats: int = REPEATS) -> float:
    samples = []
    for _ in range(repeats):
        start = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - start) * 1000)
    return statistics.median(samples)


# ---------------------------------------------------------------------------
# NFR: "ABAC Masking Response Time — trong vòng 150ms, hồ sơ tới 50 trường"
# ---------------------------------------------------------------------------

def _profile(fields: int) -> dict:
    """Hồ sơ ứng viên phẳng với đúng *fields* trường, một nửa là PII."""
    profile = {}
    for i in range(fields):
        if i % 2 == 0:
            profile[f"email_{i}"] = f"person{i}@example.com"
        else:
            profile[f"skills_matrix_{i}"] = {"python": i}
    return profile


class TestAbacMaskingLatency:
    """SRS: che PII xong trong 150ms cho hồ sơ tới 50 trường."""

    def test_a_fifty_field_profile_is_masked_well_inside_the_budget(self):
        profile = _profile(50)
        elapsed = _median_ms(lambda: apply_abac(profile, "tech_lead"))

        # Ngưỡng SRS là 150ms. Che dữ liệu là thao tác thuần CPU trên một dict
        # nhỏ; nếu nó tới gần 150ms thì có gì đó sai về bản chất, không phải
        # máy chậm.
        assert elapsed < 150, f"ABAC masking mất {elapsed:.2f}ms, ngưỡng SRS 150ms"

    def test_masking_a_deeply_nested_profile_stays_bounded(self):
        # Whitelist so khớp ĐỆ QUY theo tên field ở mọi độ sâu. Một hồ sơ lồng
        # sâu là trường hợp xấu nhất của phép duyệt đó.
        nested: dict = {"email": "a@b.c"}
        for _ in range(50):
            nested = {"enriched_profile": nested, "email": "a@b.c"}

        elapsed = _median_ms(lambda: apply_abac(nested, "tech_lead"))
        assert elapsed < 150, f"che hồ sơ lồng 50 tầng mất {elapsed:.2f}ms"

    def test_cost_grows_linearly_not_quadratically(self):
        """Gấp mười lần dữ liệu KHÔNG được làm chi phí gấp trăm.

        Đây mới là thứ test hiệu năng bắt được đáng tin trên máy dev: hình
        dạng của đường cong, chứ không phải con số tuyệt đối.
        """
        small = _median_ms(lambda: apply_abac(_profile(50), "tech_lead"))
        large = _median_ms(lambda: apply_abac(_profile(500), "tech_lead"))

        # Tuyến tính thì tỉ lệ ~10. Cho tới 30 để dư chỗ cho nhiễu đo; bậc hai
        # sẽ cho ~100 và vẫn bị bắt.
        assert large / max(small, 1e-6) < 30, (
            f"50 trường: {small:.3f}ms, 500 trường: {large:.3f}ms — "
            "chi phí tăng nhanh hơn tuyến tính"
        )

    def test_hr_is_not_charged_much_for_masking_they_do_not_get(self):
        # `hr` không bị che gì, nên đường của họ không được ĐẮT HƠN đường có
        # che. Không khẳng định nhanh hơn: cả hai vẫn phải sao chép payload, và
        # chênh lệch ở mức micro-giây thì nhiễu đo lớn hơn tín hiệu.
        profile = _profile(500)
        hr = _median_ms(lambda: apply_abac(profile, "hr"))
        tech_lead = _median_ms(lambda: apply_abac(profile, "tech_lead"))

        assert hr < tech_lead * 3, (
            f"hr {hr:.3f}ms vs tech_lead {tech_lead:.3f}ms — "
            "role không bị che gì mà lại tốn hơn hẳn"
        )


# ---------------------------------------------------------------------------
# NFR: "Calendar API Query Deadline — Sweep-Line cho tới 5 interviewer < 3 giây"
# ---------------------------------------------------------------------------

BASE = datetime(2026, 9, 1, 1, 0, tzinfo=timezone.utc)


def _free_grid(interviewers: int, blocks: int) -> dict[str, list[FreeBusyInterval]]:
    """Lịch RẢNH xen kẽ: mỗi người *blocks* khối rảnh 30 phút, lệch pha nhau.

    Lưu ý cho người đọc sau: bất chấp cái tên `interviewer_freebusy`,
    `find_slots` nhận vào khoảng RẢNH chứ không phải khoảng bận. Google trả về
    danh sách bận, và `GoogleCalendarService.fetch_freebusy` đảo nó thành rảnh
    trong giờ làm việc TRƯỚC khi đưa xuống đây. Truyền nhầm khoảng bận vào sẽ
    cho ra những khe mà tất cả mọi người đều đang bận.
    """
    grid = {}
    for person in range(interviewers):
        person_id = f"iv-{person}"
        intervals = []
        for b in range(blocks):
            start = BASE + timedelta(minutes=b * 90 + person * 7)
            intervals.append(
                FreeBusyInterval(
                    interviewer_id=person_id,
                    start_time=start,
                    end_time=start + timedelta(minutes=30),
                )
            )
        grid[person_id] = intervals
    return grid


class TestSweepLineLatency:
    """SRS: tính khe trống cho tới 5 interviewer trong 3 giây.

    Phép đo dưới đây KHÔNG gồm thời gian gọi Google Calendar — đó là mạng của
    bên thứ ba. Cái đo được ở đây là phần thuật toán, phần duy nhất mã nguồn
    này chịu trách nhiệm.
    """

    def test_five_interviewers_over_two_weeks(self):
        # 5 người × 14 ngày, mỗi ngày vài khối bận — đúng tình huống SRS mô tả.
        grid = _free_grid(interviewers=5, blocks=14 * 6)
        service = SweepLineService()

        elapsed = _median_ms(lambda: service.find_slots(grid), repeats=10)
        assert elapsed < 3000, f"Sweep-Line mất {elapsed:.2f}ms, ngưỡng SRS 3000ms"

    def test_it_stays_n_log_n_not_quadratic(self):
        """SRS mô tả thuật toán là O(N log N). Kiểm chính điều đó.

        Gấp tám lần số khoảng thời gian: O(N log N) cho khoảng ~10 lần, O(N²)
        cho ~64 lần. Khoảng cách đủ rộng để phân biệt được ngay cả khi phép đo
        nhiễu.
        """
        service = SweepLineService()
        small = _median_ms(lambda: service.find_slots(_free_grid(5, 25)), repeats=10)
        large = _median_ms(lambda: service.find_slots(_free_grid(5, 200)), repeats=10)

        assert large / max(small, 1e-6) < 25, (
            f"25 khối: {small:.3f}ms, 200 khối: {large:.3f}ms — "
            "tăng nhanh hơn N log N, nhiều khả năng đã thành bậc hai"
        )

    def test_a_fully_booked_panel_returns_quickly_and_empty(self):
        # Không ai còn khoảng rảnh nào -> không có khe nào. Phải trả về ngay,
        # không quét vô ích và không rơi vào vòng lặp vô hạn.
        fully_booked = {f"iv-{i}": [] for i in range(5)}
        service = SweepLineService()

        elapsed = _median_ms(lambda: service.find_slots(fully_booked), repeats=10)
        assert elapsed < 3000
        assert service.find_slots(fully_booked) == []

    def test_disjoint_availability_returns_nothing(self):
        # Ai cũng rảnh, nhưng không ai rảnh CÙNG LÚC với người khác.
        disjoint = {
            f"iv-{i}": [
                FreeBusyInterval(
                    interviewer_id=f"iv-{i}",
                    start_time=BASE + timedelta(hours=i * 3),
                    end_time=BASE + timedelta(hours=i * 3 + 2),
                )
            ]
            for i in range(5)
        }
        assert SweepLineService().find_slots(disjoint) == []


# ---------------------------------------------------------------------------
# NFR: "PII Field Coverage Ratio — che 100% field PII trong policy"
# ---------------------------------------------------------------------------

class TestPiiCoverage:
    """SRS đòi độ phủ 100%, và đó là thứ đo được chứ không chỉ là lời hứa."""

    #: Trường mà SRS nêu đích danh là phải che với tech_lead.
    SRS_PII_FIELDS = ("email", "phone", "phone_number", "salary_expectation")

    def test_every_field_the_srs_names_is_masked(self):
        payload = {f: "sensitive" for f in self.SRS_PII_FIELDS}
        payload["full_name"] = "Trần Bảo"

        masked = apply_abac(payload, "tech_lead")

        leaked = [k for k, v in masked.items() if v != "***"]
        assert not leaked, f"còn lộ: {leaked}"

    def test_an_unknown_field_is_masked_by_default(self):
        # Default-deny: cột PII mới thêm vào schema phải bị che NGAY, không
        # phải chờ ai đó nhớ ra để khai vào danh sách.
        masked = apply_abac({"a_brand_new_pii_column": "secret"}, "tech_lead")
        assert masked["a_brand_new_pii_column"] == "***"

    def test_technical_signal_survives(self):
        # Che hết thì tech lead không còn gì để chấm — độ phủ phải đúng chỗ.
        masked = apply_abac(
            {"email": "a@b.c", "match_confidence_score": 88.5, "top_languages": {"Go": 0.7}},
            "tech_lead",
        )
        assert masked["email"] == "***"
        assert masked["match_confidence_score"] == 88.5
        assert masked["top_languages"] == {"Go": 0.7}
