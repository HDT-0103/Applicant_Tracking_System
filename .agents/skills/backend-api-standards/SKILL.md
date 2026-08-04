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

---

## 2. API Design & Naming Conventions

### URL Naming Guidelines
- Use lower-case, plural nouns for collection resources: `/api/v1/candidates`, `/api/v1/job-postings`.
- Use sub-resources for nested relations: `/api/v1/candidates/{uuid}/applications`.
- Use specific verbs for actions: `/api/enrichment/{uuid}/sync`, `/api/auth/refresh`.
- Always prefix public or internal API endpoints with `/api/v1` or `/api/{module}`.

### HTTP Method Mapping
- `GET`: Retrieve resource or collection (safe, idempotent).
- `POST`: Create resource or trigger action execution.
- `PUT`: Replace resource entirely.
- `PATCH`: Partial update of resource fields.
- `DELETE`: Remove or soft-delete resource.

---

## 3. Data Transfer Objects (DTOs) & Validation

All request payloads and response bodies MUST use Pydantic v2 models with explicit type hints and field constraints.

```python
# Pydantic Request Model
class CandidateCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, example="Jane Doe")
    email: EmailStr = Field(..., example="jane.doe@example.com")
    phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{1,14}$")
    linkedin_url: Optional[HttpUrl] = None
    github_username: Optional[str] = Field(None, pattern=r"^[a-zA-Z0-9-]+$")

# Pydantic Response Model
class CandidateResponse(BaseModel):
    uuid: str
    full_name: str
    email: EmailStr
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
```

---

## 4. Standardized Error Responses (RFC 7807)

API errors MUST follow a uniform JSON payload format:

```json
{
  "code": "HTTP_400_BAD_REQUEST",
  "detail": "Validation failed: Document must be a valid PDF format constraint!",
  "timestamp": "2026-07-29T09:30:00Z",
  "path": "/api/v1/ingest"
}
```

### Exception Handling Rules
- Throw FastAPI `HTTPException` with appropriate status code (`status.HTTP_400_BAD_REQUEST`, `status.HTTP_401_UNAUTHORIZED`, `status.HTTP_403_FORBIDDEN`, `status.HTTP_404_NOT_FOUND`).
- Catch low-level infrastructure exceptions in service layer and re-raise as domain-friendly `ValueError` or `HTTPException`.
- Never leak raw stack traces or internal secret strings in HTTP error responses.

---

## 5. Pagination, Filtering, & Sorting Standard

### Request Query Parameters
```python
@router.get("/api/v1/candidates", response_model=PaginatedResponse[CandidateResponse])
async def list_candidates(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by candidate status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    order: Literal["asc", "desc"] = Query("desc", description="Sort order")
):
    ...
```

### Standard Paginated Envelope
```python
T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int
```

---

## 6. Dependency Injection & Service Layer Pattern

FastAPI `Depends` MUST be used to inject configurations, database instances, and authentication state:

```python
def get_enrichment_service(
    settings: Annotated[Settings, Depends(get_settings)]
) -> EnrichmentService:
    return EnrichmentService(settings=settings)

@router.post("/{candidate_uuid}/sync")
async def sync_candidate(
    candidate_uuid: str,
    service: Annotated[EnrichmentService, Depends(get_enrichment_service)],
    current_user: Annotated[AuthUser, Depends(require_roles("recruiter", "admin", "hr_manager"))]
):
    return await service.run_sync(candidate_uuid, current_user)
```

---

## 7. AI Agent Guidelines for Backend API Code

### When Should AI Load This Skill?
Load this skill when building new FastAPI routes, writing backend services, creating Pydantic schemas, or adding exception handlers.

### Which Other Skills Should Be Loaded Together?
- `shared-infrastructure` (for FastAPI app settings & logging)
- `security-governance` (for JWT and role guards)
- `database-schema-standards` (for persistence integration)

### Best Practices & Anti-Patterns
- **Do NOT put SQL or external API calls inside route functions**: Route handlers should only validate input, call application services, and return responses.
- **Do NOT return raw dictionary primitives**: Always return validated Pydantic response models.
- **Always specify `response_model` and `status_code` in route decorators**.
