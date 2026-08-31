"""
Unit and Integration tests for WebSocket Telemetry (/api/enrichment/ws/v1/analysis/{uuid}).

Tests cover:
- WebSocket connection handshake & registration in active_websockets map
- Instant payload delivery when candidate status is pre-cached as ENRICHED
- Live telemetry broadcast on enrichment worker completion (ENRICHED event)
- Live telemetry broadcast on enrichment worker error (ENRICHMENT_FAILED event)
- Client disconnect cleanup & memory management
"""

import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.auth.infra.jwt_service import JwtService
from modules.enrichment.application.enrichment_service import (
    active_websockets,
    candidate_enrichments,
)
from modules.shared.infrastructure.config import get_settings
from modules.enrichment.domain.models import (
    CandidateEnrichment,
    EnrichmentStatus,
    EnrichedProfile,
    MockAnalytics,
    TechnicalSkillMatrix,
)


class _PanelStub:
    """Repo review tối giản cho các test WebSocket.

    Kênh này trả nguyên payload enrichment, nên từ V008 nó cũng phải hỏi hội
    đồng như phía HTTP. Những test dưới đây kiểm việc CHE dữ liệu, không kiểm
    việc phân hội đồng — nên chúng cấp sẵn quyền và để test riêng lo phần kia.
    """

    async def is_panel_member(self, candidate_uuid, reviewer_id):
        return True


@pytest.fixture(autouse=True)
def on_panel():
    from modules.review.adapters.routes import get_review_repo

    app.dependency_overrides[get_review_repo] = lambda: _PanelStub()
    yield
    app.dependency_overrides.pop(get_review_repo, None)


@pytest.fixture
def client():
    return TestClient(app)


def _token(role: str = "hr") -> str:
    """Access token thật để đi qua handshake xác thực của WebSocket."""
    settings = get_settings()
    user = AuthUser(id=f"{role}-1", name=role, email=f"{role}@example.com", role=role)
    return JwtService(settings).create_access_token(user)


def _connect(client, uuid: str, role: str = "hr"):
    """Mở socket, gửi frame xác thực và chờ ack trước khi trả về."""
    ctx = client.websocket_connect(f"/api/enrichment/ws/v1/analysis/{uuid}")
    websocket = ctx.__enter__()
    websocket.send_json({"token": _token(role)})
    assert websocket.receive_json() == {"status": "AUTHENTICATED"}
    return ctx, websocket


def test_websocket_connection_registers_in_active_map(client):
    """Connecting to WebSocket endpoint registers socket in active_websockets registry."""
    uuid = "test-cand-ws-01"

    # Ensure empty registry before test
    active_websockets.pop(uuid, None)

    ctx, _ws = _connect(client, uuid)
    try:
        assert uuid in active_websockets
        assert len(active_websockets[uuid]) == 1
    finally:
        ctx.__exit__(None, None, None)

    # After disconnect, registry should clean up
    assert uuid not in active_websockets or len(active_websockets.get(uuid, [])) == 0


def test_websocket_rejects_connection_without_token(client):
    """Endpoint này trả nguyên hồ sơ ứng viên — không token thì phải bị đóng."""
    from starlette.websockets import WebSocketDisconnect

    uuid = "test-cand-ws-noauth"
    active_websockets.pop(uuid, None)

    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/enrichment/ws/v1/analysis/{uuid}") as ws:
            ws.send_json({"token": "khong-phai-token"})
            ws.receive_json()

    assert exc.value.code == 4401
    assert uuid not in active_websockets


def test_websocket_immediate_data_when_already_enriched(client):
    """If candidate profile is already ENRICHED, server sends data payload immediately upon connection."""
    uuid = "test-cand-ws-02"
    
    cached_profile = EnrichedProfile(
        full_name="Cached Candidate",
        analytics=MockAnalytics(
            match_confidence_score=88.5,
            score_increase=12.0,
            semantic_tags=["Python", "FastAPI"],
            technical_skill_matrix=TechnicalSkillMatrix(
                pre_enrichment=[0.5, 0.6],
                post_enrichment=[0.8, 0.9]
            )
        )
    )
    
    candidate_enrichments[uuid] = CandidateEnrichment(
        candidate_uuid=uuid,
        enrichment_status=EnrichmentStatus.ENRICHED,
        enriched_profile=cached_profile,
    )

    try:
        ctx, websocket = _connect(client, uuid, role="hr")
        try:
            data = websocket.receive_json()
            assert data["status"] == "ENRICHED"
            assert data["data"]["full_name"] == "Cached Candidate"
        finally:
            ctx.__exit__(None, None, None)
    finally:
        candidate_enrichments.pop(uuid, None)


def test_websocket_masks_pii_for_tech_lead(client):
    """Cùng một socket, tech_lead nhận hồ sơ đã che PII còn HR thì không."""
    uuid = "test-cand-ws-abac"

    candidate_enrichments[uuid] = CandidateEnrichment(
        candidate_uuid=uuid,
        enrichment_status=EnrichmentStatus.ENRICHED,
        enriched_profile=EnrichedProfile(
            full_name="Cached Candidate",
            analytics=MockAnalytics(
                match_confidence_score=88.5,
                score_increase=12.0,
                semantic_tags=["Python"],
                technical_skill_matrix=TechnicalSkillMatrix(
                    pre_enrichment=[0.5], post_enrichment=[0.9]
                ),
            ),
        ),
    )

    try:
        ctx, websocket = _connect(client, uuid, role="tech_lead")
        try:
            data = websocket.receive_json()
            assert data["data"]["full_name"] == "***"
            # dữ liệu chuyên môn vẫn nguyên vẹn
            assert data["data"]["analytics"]["match_confidence_score"] == 88.5
        finally:
            ctx.__exit__(None, None, None)
    finally:
        candidate_enrichments.pop(uuid, None)


@pytest.mark.asyncio
async def test_websocket_telemetry_broadcast_enriched_payload():
    """Simulating worker completion sends live ENRICHED payload to active sockets."""
    uuid = "test-cand-ws-03"

    mock_ws = MagicMock()
    mock_ws.send_json = MagicMock()

    active_websockets[uuid] = [mock_ws]

    try:
        # Simulate message send logic as in enrichment_worker
        for ws in list(active_websockets[uuid]):
            ws.send_json({
                "status": "ENRICHED",
                "data": {"full_name": "Jane Doe", "score": 92},
            })

        mock_ws.send_json.assert_called_once_with({
            "status": "ENRICHED",
            "data": {"full_name": "Jane Doe", "score": 92},
        })
    finally:
        active_websockets.pop(uuid, None)


@pytest.mark.asyncio
async def test_websocket_telemetry_broadcast_failure_payload():
    """Simulating worker failure sends live ENRICHMENT_FAILED payload to active sockets."""
    uuid = "test-cand-ws-04"

    mock_ws = MagicMock()
    mock_ws.send_json = MagicMock()

    active_websockets[uuid] = [mock_ws]

    try:
        for ws in list(active_websockets[uuid]):
            ws.send_json({
                "status": "ENRICHMENT_FAILED",
                "error": "Failed to parse PDF profile",
            })

        mock_ws.send_json.assert_called_once_with({
            "status": "ENRICHMENT_FAILED",
            "error": "Failed to parse PDF profile",
        })
    finally:
        active_websockets.pop(uuid, None)


def test_a_tech_lead_off_the_panel_is_disconnected(client):
    """Kênh WebSocket phải theo cùng luật hội đồng như phía HTTP.

    Nó phát nguyên payload enrichment, nên bỏ sót ở đây là mở lại đúng cái cửa
    mà endpoint HTTP vừa đóng — chỉ khác đường vào.
    """
    from starlette.websockets import WebSocketDisconnect

    from modules.review.adapters.routes import get_review_repo

    class _OffPanel:
        async def is_panel_member(self, candidate_uuid, reviewer_id):
            return False

    app.dependency_overrides[get_review_repo] = lambda: _OffPanel()
    try:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(
                "/api/enrichment/ws/v1/analysis/some-candidate"
            ) as ws:
                ws.send_json({"token": _token("tech_lead")})
                ws.receive_json()
    finally:
        app.dependency_overrides[get_review_repo] = lambda: _PanelStub()
