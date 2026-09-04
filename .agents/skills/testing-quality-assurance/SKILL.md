---
name: testing-quality-assurance
description: Enterprise testing standards — Pytest unit/integration tests, FastAPI TestClient API testing, external service mocking, AI evaluation tests, and regression testing for SmartATS
version: 2.0.0
author: SmartATS Quality Engineering Team
tech_stack:
  - Pytest
  - FastAPI TestClient
  - unittest.mock
  - Jest / React Testing Library
  - Playwright E2E
when_to_use:
  - "write unit or integration tests for backend services"
  - "mock external HTTP services (Gemini API, GitHub API, Apify LinkedIn)"
  - "test FastAPI REST endpoints or WebSocket handlers"
  - "validate AI parsing accuracy and JSON schema regression"
---

# Enterprise Testing & Quality Assurance Standards

## 1. Overview & Test Pyramid

Quality assurance for SmartATS spans backend Python services, AI extraction pipelines, REST APIs, and Next.js frontend components.

```
       ▲
      / \        E2E Tests (Playwright) - Careers flow & Workspace
     /   \       ----------------------------------------------------
    /     \      Integration & API Tests (FastAPI TestClient + Supabase)
   /       \     ----------------------------------------------------
  /         \    Unit Tests (Pytest, Mocks for Gemini / GitHub / Apify)
 ─────────────
```

---

## 2. Unit & Service Testing (Pytest)

All business services MUST have corresponding unit tests under `tests/`:

```python
# tests/unit/test_jwt_service.py
import pytest
from modules.auth.domain.models import AuthUser
from modules.auth.infra.jwt_service import JwtService

def test_create_and_decode_access_token(mock_settings):
    jwt_service = JwtService(mock_settings)
    user = AuthUser(id="usr_123", email="recruiter@example.com", name="Jane", role="recruiter")
    
    token = jwt_service.create_access_token(user)
    decoded = jwt_service.decode_token(token, expected_type="access")
    
    assert decoded.id == user.id
    assert decoded.email == user.email
    assert decoded.role == "recruiter"
```

---

## 3. Mocking External Services

External cloud dependencies (Google Gemini, GitHub REST API, Apify LinkedIn, Azure Blob/Service Bus) MUST be mocked during unit and integration test runs to prevent test flakiness and API costs.

### Mocking Gemini API
```python
@pytest.fixture
def mock_gemini_parser(mocker):
    mock_parser = mocker.patch("modules.enrichment.application.gemini_parser_service.parse_cv_pdf")
    mock_parser.return_value = {
        "full_name": "Test Candidate",
        "email": "test@example.com",
        "skills": ["Python", "FastAPI", "React"]
    }
    return mock_parser
```

### Mocking GitHub REST API
```python
@pytest.fixture
def mock_github_api(httpx_mock):
    httpx_mock.add_response(
        url="https://api.github.com/users/testuser/repos",
        json=[{"name": "smart-ats", "language": "Python", "size": 1200}]
    )
```

---

## 4. API Endpoint Integration Testing

Test FastAPI endpoints end-to-end using `starlette.testclient.TestClient`:

```python
from fastapi.testclient import TestClient
from apps.main import app

client = TestClient(app)

def test_enrichment_sync_unauthorized():
    response = client.post("/api/enrichment/test-uuid/sync")
    assert response.status_code == 401

def test_enrichment_sync_authorized(auth_header_recruiter):
    response = client.post(
        "/api/enrichment/test-uuid/sync",
        headers=auth_header_recruiter
    )
    assert response.status_code in [200, 202, 404]
```


---

## 5. AI Parsing Accuracy & Regression Testing

To prevent regressions in Gemini resume extraction:
1. Maintain a dataset of sample anonymized resumes under `tests/fixtures/resumes/`.
2. Compare extracted JSON output against expected ground-truth JSON files.
3. Assert minimum accuracy threshold (> 90% match on key fields like email, phone, and skills).

---

## 6. AI Agent Guidelines for Testing

### When Should AI Load This Skill?
Load this skill whenever writing Pytest files, adding test fixtures, mocking external API integrations, or verifying route test coverage.

### Best Practices:
- **Never make live network calls in unit tests**. Always mock Gemini, Apify, GitHub, and Azure SDK calls.
- **Isolate test database state**: Use transaction rollback fixtures or test Supabase projects.
- **Maintain > 80% code coverage** for core application services in `src/backend/modules/*/application/`.
