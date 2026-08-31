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
