"""Nguồn dữ liệu cho bước tra link mạng xã hội của ứng viên.

Bối cảnh: `candidate_repository.get_candidate()` đọc từ dict `candidate_store`
nằm trong RAM. Sau mỗi lần khởi động lại backend nó rỗng, nên worker enrich báo
"candidate không tồn tại" dù hàng dữ liệu vẫn nằm nguyên trong bảng
`candidates`. Hệ quả: bỏ qua hẳn bước lấy GitHub/LinkedIn và điểm khớp ra 0.

Chạy nhiều worker cũng hỏng y hệt vì mỗi tiến trình giữ một dict riêng.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from modules.enrichment.application import enrichment_service as svc


def _client_returning(rows: list[dict]) -> MagicMock:
    """Supabase client giả cho chuỗi .table().select().eq().limit().execute()."""
    result = MagicMock()
    result.data = rows
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        result
    )
    return client


@pytest.fixture(autouse=True)
def _empty_memory_store(monkeypatch):
    """Giả lập tiến trình vừa khởi động: dict trong RAM rỗng."""
    monkeypatch.setattr(svc, "get_candidate", lambda _uuid: None)


def test_doc_duoc_link_tu_supabase_khi_ram_rong(monkeypatch):
    """Đây chính là ca hỏng: RAM rỗng nhưng DB có dữ liệu."""
    monkeypatch.setattr(
        svc,
        "get_supabase_client",
        lambda *_a, **_k: _client_returning(
            [{"github_username": "octocat", "linkedin_url": "https://lnkd.in/x"}]
        ),
    )

    links = svc.get_candidate_social_links("uuid-1")

    assert links.github_username == "octocat"
    assert links.linkedin_url == "https://lnkd.in/x"


def test_ung_vien_khong_co_link_thi_tra_ve_rong(monkeypatch):
    monkeypatch.setattr(
        svc,
        "get_supabase_client",
        lambda *_a, **_k: _client_returning(
            [{"github_username": None, "linkedin_url": None}]
        ),
    )

    links = svc.get_candidate_social_links("uuid-2")

    assert links.github_username is None
    assert links.linkedin_url is None


def test_khong_co_hang_nao_trong_db(monkeypatch):
    monkeypatch.setattr(
        svc, "get_supabase_client", lambda *_a, **_k: _client_returning([])
    )

    links = svc.get_candidate_social_links("uuid-khong-ton-tai")

    assert links.github_username is None


def test_supabase_loi_thi_khong_lam_vo_luot_enrich(monkeypatch):
    """DB lỗi thì rơi về bộ nhớ, không ném exception lên worker."""

    def _boom(*_a, **_k):
        raise RuntimeError("supabase down")

    monkeypatch.setattr(svc, "get_supabase_client", _boom)

    links = svc.get_candidate_social_links("uuid-3")

    assert links.github_username is None  # rỗng, nhưng KHÔNG ném lỗi


def test_bo_nho_van_dung_khi_db_chua_kip_ghi(monkeypatch):
    """CV vừa upload trong cùng tiến trình, DB chưa có hàng — bộ nhớ đỡ."""
    monkeypatch.setattr(
        svc, "get_supabase_client", lambda *_a, **_k: _client_returning([])
    )
    cached = MagicMock()
    cached.github_username = "from-memory"
    cached.linkedin_url = None
    monkeypatch.setattr(svc, "get_candidate", lambda _uuid: cached)

    links = svc.get_candidate_social_links("uuid-4")

    assert links.github_username == "from-memory"


def test_supabase_duoc_uu_tien_hon_bo_nho(monkeypatch):
    """DB là nguồn chính; bộ nhớ chỉ là bản dự phòng, không được lấn át."""
    monkeypatch.setattr(
        svc,
        "get_supabase_client",
        lambda *_a, **_k: _client_returning([{"github_username": "from-db", "linkedin_url": None}]),
    )
    stale = MagicMock()
    stale.github_username = "from-memory"
    stale.linkedin_url = None
    monkeypatch.setattr(svc, "get_candidate", lambda _uuid: stale)

    assert svc.get_candidate_social_links("uuid-5").github_username == "from-db"
