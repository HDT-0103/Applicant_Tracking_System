"""Giới hạn tần suất trên các endpoint công khai.

`/api/auth/login` và `/api/auth/register` không có token nào để gác, nên tần
suất là hàng rào duy nhất giữa một vòng lặp dò mật khẩu và bảng `users`.
"""
from __future__ import annotations

import time

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from modules.shared.infrastructure.rate_limit import RateLimit, client_key


def _app(limiter: RateLimit) -> TestClient:
    app = FastAPI()

    @app.get("/probe", dependencies=[Depends(limiter)])
    def probe():
        return {"ok": True}

    return TestClient(app)


def test_requests_under_the_limit_pass():
    client = _app(RateLimit("probe", limit=3, seconds=60))
    assert [client.get("/probe").status_code for _ in range(3)] == [200, 200, 200]


def test_the_request_over_the_limit_is_refused_with_429():
    client = _app(RateLimit("probe", limit=2, seconds=60))
    client.get("/probe")
    client.get("/probe")

    blocked = client.get("/probe")
    assert blocked.status_code == 429
    # Không có Retry-After thì client chỉ biết thử lại mù, và thường là thử
    # lại ngay — làm tình hình tệ thêm.
    assert int(blocked.headers["Retry-After"]) >= 1


def test_the_window_slides_rather_than_resetting_on_a_clock_boundary():
    # Cửa sổ cố định cho phép gấp đôi hạn mức ngay chỗ giao nhau: đủ lượt ở
    # cuối cửa sổ này cộng đủ lượt ở đầu cửa sổ sau, cách nhau vài giây.
    client = _app(RateLimit("probe", limit=2, seconds=1))
    assert client.get("/probe").status_code == 200
    assert client.get("/probe").status_code == 200
    assert client.get("/probe").status_code == 429

    time.sleep(1.1)
    assert client.get("/probe").status_code == 200


def test_one_client_hitting_the_limit_does_not_block_another():
    limiter = RateLimit("probe", limit=1, seconds=60)
    client = _app(limiter)

    assert client.get("/probe", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.get("/probe", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 429
    # Nếu bộ đếm dùng chung, người dùng thứ hai bị chặn vì lỗi của người thứ nhất.
    assert client.get("/probe", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 200


def test_the_forwarded_client_ip_wins_over_the_proxy_ip():
    # Sau reverse proxy, request.client.host là IP của proxy — dùng nó nghĩa là
    # cả hệ thống chia nhau MỘT hạn mức.
    class _Req:
        headers = {"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
        client = type("C", (), {"host": "10.0.0.1"})()

    assert client_key(_Req()) == "203.0.113.7"


def test_a_client_with_no_address_still_gets_a_key():
    class _Req:
        headers: dict[str, str] = {}
        client = None

    assert client_key(_Req()) == "unknown"


def test_idle_clients_are_evicted_so_the_counter_does_not_grow_forever():
    limiter = RateLimit("probe", limit=1, seconds=1)
    client = _app(limiter)

    for i in range(5):
        client.get("/probe", headers={"X-Forwarded-For": f"10.0.0.{i}"})
    assert len(limiter._hits) == 5

    time.sleep(1.1)
    # Lượt bị chặn kế tiếp dọn các ô đã nguội; không có bước này thì mọi IP
    # từng ghé qua sẽ nằm lại trong bộ nhớ đến hết đời tiến trình.
    client.get("/probe", headers={"X-Forwarded-For": "10.0.0.99"})
    client.get("/probe", headers={"X-Forwarded-For": "10.0.0.99"})
    assert len(limiter._hits) == 1


class TestLiveEndpoints:
    @pytest.fixture(autouse=True)
    def _clean(self):
        from modules.shared.infrastructure import rate_limit

        rate_limit.login_rate_limit.reset()
        yield
        rate_limit.login_rate_limit.reset()

    def test_login_stops_a_password_guessing_loop(self):
        from apps.main import app
        from modules.shared.infrastructure.rate_limit import login_rate_limit

        client = TestClient(app)
        codes = [
            client.post(
                "/api/auth/login",
                json={"email": "victim@smartats.com", "password": f"guess-{i}"},
            ).status_code
            for i in range(login_rate_limit._window.limit + 2)
        ]

        # Đoán sai trả 401; điều cần khẳng định là vòng lặp KHÔNG chạy mãi được.
        assert 429 in codes
        assert codes[-1] == 429
