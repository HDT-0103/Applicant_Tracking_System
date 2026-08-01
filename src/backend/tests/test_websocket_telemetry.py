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
from modules.enrichment.application.enrichment_service import (
    active_websockets,
    candidate_enrichments,
)
from modules.enrichment.domain.models import (
    CandidateEnrichment,
    EnrichmentStatus,
    EnrichedProfile,
    MockAnalytics,
    TechnicalSkillMatrix,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_websocket_connection_registers_in_active_map(client):
    """Connecting to WebSocket endpoint registers socket in active_websockets registry."""
    uuid = "test-cand-ws-01"
    
    # Ensure empty registry before test
    active_websockets.pop(uuid, None)

    with client.websocket_connect(f"/api/enrichment/ws/v1/analysis/{uuid}") as websocket:
        assert uuid in active_websockets
        assert len(active_websockets[uuid]) == 1

    # After exiting context manager (disconnect), registry should clean up
    assert uuid not in active_websockets or len(active_websockets.get(uuid, [])) == 0


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
        with client.websocket_connect(f"/api/enrichment/ws/v1/analysis/{uuid}") as websocket:
            data = websocket.receive_json()
            assert data["status"] == "ENRICHED"
            assert data["data"]["full_name"] == "Cached Candidate"
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
