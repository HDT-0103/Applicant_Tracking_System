"""Smoke test: app phải khởi động được và mount đủ route.

Không có test nào loại này nên hai lỗi dưới đây từng sống rất lâu mà không ai
biết, dù chúng làm app chết ngay lúc khởi động:

* `.env` ghi `SUPABASE_SERVICE_KEY` trong khi `Settings` đòi
  `SUPABASE_SERVICE_ROLE_KEY` — `import apps.main` ném ValidationError;
* `Dockerfile` trỏ `app.main:app`, module không tồn tại.

Test này rẻ và chạy trong vài giây, nhưng bắt đúng loại hỏng tệ nhất: hỏng
toàn bộ, ở ngay bước đầu tiên.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.main import app

#: Nhóm route nghiệp vụ. Thiếu tiền tố nào nghĩa là cả một router rơi khỏi
#: `apps/main.py` — cả mảng tính năng biến mất mà test đơn lẻ không thấy.
#
#: `/api/ingestion` KHÔNG còn trong danh sách: đường nạp CV cũ đã bị gỡ vì nó
#: là bản sao yếu hơn của `/api/v1/ingest` — ghi PDF ra đĩa server (mất sau mỗi
#: lần deploy) và tạo candidate mồ côi không có application. `/api/catalog` là
#: module thay cho việc trình duyệt hỏi thẳng PostgREST.
EXPECTED_PREFIXES = (
    "/api/auth",
    "/api/admin",
    "/api/catalog",
    "/api/enrichment",
    "/api/scheduling",
    "/api/review",
    "/api/v1",
)


def _walk_routes(routes):
    """Duyệt phẳng toàn bộ route, đi xuyên qua router đã include.

    FastAPI >= 0.13x bọc mỗi `include_router` trong một `_IncludedRouter` không
    có thuộc tính `.path`. Lặp thẳng trên `app.routes` sẽ bỏ sót gần hết route
    thật — và tệ hơn, bỏ sót một cách im lặng.
    """
    for route in routes:
        original = getattr(route, "original_router", None)
        if original is not None:
            yield from _walk_routes(original.routes)
        else:
            yield route


@pytest.fixture(scope="module")
def paths() -> set[str]:
    return set(app.openapi()["paths"])


def test_health_endpoint_responds():
    response = TestClient(app).get("/health")
    assert response.status_code == 200


def test_every_router_group_is_mounted(paths):
    missing = [p for p in EXPECTED_PREFIXES if not any(x.startswith(p) for x in paths)]
    assert not missing, f"Router rơi khỏi apps/main.py: {missing}"


def test_openapi_schema_builds(paths):
    """OpenAPI dựng được nghĩa là mọi response_model đều hợp lệ.

    Một Pydantic model hỏng chỉ lộ ra khi sinh schema hoặc khi có request thật
    chạm vào route đó — dựng schema ở đây là cách rẻ nhất để phát hiện sớm.
    """
    assert len(paths) >= 25, f"Chỉ thấy {len(paths)} route, nghi có router chưa mount"


def test_enrichment_websocket_route_exists():
    """WebSocket telemetry (U002) mà rơi thì UI vẫn tải được, chỉ là không bao
    giờ nhận được cập nhật — hỏng im lặng, rất khó lần ra.

    Route WebSocket không xuất hiện trong OpenAPI nên phải dò trực tiếp.
    """
    ws_routes = [
        r.path for r in _walk_routes(app.routes)
        if getattr(r, "path", "").startswith("/api/enrichment/ws/")
    ]
    assert ws_routes, "Không tìm thấy route WebSocket của enrichment"


def test_no_duplicate_route_paths():
    """Hai route trùng đường dẫn thì cái sau bị che, thường là do merge cẩu thả."""
    seen: dict[tuple[str, str], int] = {}
    for route in _walk_routes(app.routes):
        path = getattr(route, "path", None)
        if path is None:
            continue
        for method in sorted(getattr(route, "methods", None) or {"WS"}):
            seen[(method, path)] = seen.get((method, path), 0) + 1

    duplicates = [key for key, count in seen.items() if count > 1]
    assert not duplicates, f"Route bị khai báo trùng: {duplicates}"
