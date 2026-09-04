---
name: backend-api-standards
description: Enterprise FastAPI backend architecture standards — REST API conventions, Clean Architecture, Repository Pattern, DTO schemas, error handling, pagination, and dependency injection for SmartATS
version: 2.0.0
author: SmartATS Backend Architecture Team
tech_stack:
  - FastAPI 0.110+
  - Python 3.11+
  - Pydantic v2
  - Uvicorn / Gunicorn
  - Structlog
when_to_use:
  - "create or modify FastAPI REST endpoints"
  - "implement service layer or repository pattern logic"
  - "define Pydantic request/response DTOs"
  - "configure global error handling or HTTP exceptions"
  - "implement API pagination, filtering, or sorting"
---

# Backend API Architecture & Engineering Standards

## 1. Modular Monolith Architecture

SmartATS follows a **Modular Monolith + Clean Architecture** pattern. Each functional domain is encapsulated into a self-contained module under `src/backend/modules/`:

```
src/backend/modules/{domain}/
├── adapters/                  # Delivery layer: FastAPI routers, WebSockets
│   └── routes.py
├── application/               # Application logic: Orchestrators, Services
│   └── {domain}_service.py
├── domain/                    # Enterprise logic: Entities, Value Objects, Pydantic DTOs
│   ├── models.py
│   └── repository_interface.py
└── infra/                     # Infrastructure implementations: Database, Cloud APIs
    └── {domain}_repository.py
```

Entrypoint is located at `src/backend/apps/main.py` (FastAPI app, version 4.2.1).

---

## 2. API Design & Naming Conventions

### Registered Routers & Endpoints
- **Auth**: `/api/auth/google`, `/api/auth/refresh`
- **Ingestion (Standard)**: `/api/ingestion/upload`
- **Ingestion (Azure)**: `/api/v1/ingest`
- **Enrichment**: `/api/enrichment/{candidate_uuid}/sync`, `/api/enrichment/{candidate_uuid}`
- **WebSocket Analysis**: `/api/enrichment/ws/v1/analysis/{candidate_uuid}`
- **Health Check**: `/health`

### HTTP Method Mapping
- `GET`: Retrieve resource or collection (safe, idempotent).
- `POST`: Create resource or trigger action execution (`202 Accepted` for background enrichment).
- `PUT`: Replace resource entirely.
- `PATCH`: Partial update of resource fields.
- `DELETE`: Remove or soft-delete resource.

---

## 3. Data Transfer Objects (DTOs) & Validation

All request payloads and response bodies MUST use Pydantic v2 models with explicit type hints and field constraints.

```python
# Pydantic Request Model
class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=10)

# Pydantic Response Model
class AuthTokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AuthUser
    
    model_config = ConfigDict(from_attributes=True)
```

---

## 4. Standardized Error Responses & Exception Handling

API errors throw FastAPI `HTTPException` with clear error messages:

```json
{
  "detail": "Validation failed: Document must be a valid PDF format constraint!"
}
```

### CORS & Security Middleware (`main.py`)
- CORS origins configured via `CORS_ORIGINS` setting.
- In `development` mode, `allow_origin_regex` dynamically allows `https?://(localhost|127\.0\.0\.1)(:\d+)?`.
- On Windows OS, sets `WindowsSelectorEventLoopPolicy` for Playwright subprocess compatibility.

---

## 5. Dependency Injection & Service Layer Pattern

FastAPI `Depends` MUST be used to inject configurations, database instances, and authentication state:

```python
def get_auth_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    return AuthService(
        settings=settings,
        google_verifier=GoogleTokenVerifier(settings),
        jwt_service=JwtService(settings),
    )

@router.post("/google", response_model=AuthTokenResponse)
def google_login(
    payload: GoogleLoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthTokenResponse:
    return auth_service.login_with_google(payload.credential)
```

---

## 6. AI Agent Guidelines for Backend API Code

### When Should AI Load This Skill?
Load this skill when building new FastAPI routes, writing backend services, creating Pydantic schemas, or adding exception handlers.

### Which Other Skills Should Be Loaded Together?
- `shared-infrastructure` (for FastAPI app settings & logging)
- `security-governance` (for JWT and role guards)
- `database-schema-standards` (for persistence integration)

### Best Practices & Anti-Patterns
- **Do NOT put database queries or external scraping inside route functions**: Route handlers should only validate input, call application services, and return responses.
- **Do NOT return raw untyped dictionaries**: Always return validated Pydantic response models.
- **Always specify `response_model` and `status_code` in route decorators**.

