"""Chỉ chạy khi bật RUN_INTEGRATION_TESTS.

Những test trong thư mục này gọi Supabase THẬT: RPC vector, insert/update trên
bảng thật. Chúng có giá trị — là nơi duy nhất kiểm được rằng RPC tồn tại và trả
về đúng hình dạng — nhưng không chạy được trên CI, nơi không có (và không nên
có) khoá vào cơ sở dữ liệu sản xuất.

Theo đúng quy ước sẵn có ở `tests/services/test_github_retrieval_service.py`:
một biến môi trường bật/tắt, để cả repo chỉ có một cách diễn đạt "test này cần
DB".

    RUN_INTEGRATION_TESTS=true ./venv/bin/python -m pytest tests/repositories

Dùng `collect_ignore_glob` chứ KHÔNG dùng `pytest_collection_modifyitems`: hook
đó nhận danh sách item của TOÀN BỘ phiên chạy, không riêng thư mục này, nên
đánh dấu skip trong đó sẽ tắt sạch mọi test của repo.
"""
import os

_RUN_INTEGRATION = os.getenv("RUN_INTEGRATION_TESTS", "false").lower() == "true"

collect_ignore_glob = [] if _RUN_INTEGRATION else ["test_*.py"]

import os

import pytest
from supabase import Client, create_client

from src.backend.app.database import connection as connection_module
from src.backend.app.repositories import base as repository_base_module


@pytest.fixture(scope="session")
def service_role_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_role_key:
        pytest.skip("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for integration tests.")
    return create_client(url, service_role_key)


@pytest.fixture(autouse=True)
def use_service_role_client(monkeypatch: pytest.MonkeyPatch, service_role_client: Client) -> Client:
    monkeypatch.setattr(connection_module, "supabase", service_role_client)
    monkeypatch.setattr(repository_base_module, "supabase", service_role_client)
    return service_role_client
