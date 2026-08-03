"""
Unit and Integration tests for AdminRouter (/api/admin).

Tests cover:
- Global RBAC role enforcement (Admin role required)
- Rejection of Non-Admin users (403 Forbidden)
- User list retrieval & user role/approval updates
"""

from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.admin.adapters.routes import get_admin_service
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.auth_dependencies import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


def test_admin_route_rejected_for_non_admin(client):
    """User with 'recruiter' or 'hr' role is rejected with 403 Forbidden."""
    hr_user = AuthUser(id="hr-1", name="HR User", email="hr@example.com", role="hr", is_approved=True)
    app.dependency_overrides[get_current_user] = lambda: hr_user

    try:
        response = client.get("/api/admin/users")
        assert response.status_code == 403
        assert "not permitted" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_admin_route_accessible_for_admin(client):
    """User with 'admin' role accesses /api/admin/users successfully."""
    admin_user = AuthUser(id="admin-1", name="Admin User", email="admin@example.com", role="admin", is_approved=True)
    mock_service = MagicMock()
    mock_service.get_users = AsyncMock(return_value=[
        {"id": "usr-1", "email": "user1@example.com", "role": "hr", "is_approved": True}
    ])

    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_service

    try:
        response = client.get("/api/admin/users")
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["email"] == "user1@example.com"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_admin_service, None)


def test_update_user_requires_valid_payload(client):
    """PATCH /api/admin/users/{user_id} with empty payload returns 400 Bad Request."""
    admin_user = AuthUser(id="admin-1", name="Admin User", email="admin@example.com", role="admin", is_approved=True)
    app.dependency_overrides[get_current_user] = lambda: admin_user

    try:
        response = client.patch("/api/admin/users/usr-123", json={})
        assert response.status_code == 400
        assert "Provide 'role' and/or 'is_approved'" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
