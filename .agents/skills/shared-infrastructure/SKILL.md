---
name: shared-infrastructure
description: Cross-cutting infrastructure layer — FastAPI application factory, Pydantic Settings, Supabase client initialization, CORS, auth dependencies, and structlog structured logging
version: 2.0.0
author: SmartATS Core Infrastructure Team
tech_stack:
  - FastAPI 0.110+
  - Python 3.11+
  - Supabase Python SDK
  - Pydantic Settings
  - Structlog
when_to_use:
  - "configure environment settings and Pydantic BaseSettings"
  - "initialize Supabase clients (Anon vs Admin Service Role client)"
  - "configure FastAPI middleware (CORS, Request Tracing, Logging)"
  - "implement cross-cutting auth dependencies (require_roles)"
  - "setup structured JSON logging with structlog"
---

# Shared Infrastructure Module

## 1. Overview & Architecture

The shared infrastructure module provides cross-cutting foundational services used across all domain modules: environment configuration parsing, database client factories, role-based dependency guards, CORS rules, and structured logging.

```
src/backend/modules/shared/
├── domain/
│   └── supabase_models.py      # Pydantic models for Supabase tables (User, RoleType)
└── infrastructure/
    ├── config.py               # Central Settings via Pydantic BaseSettings
    ├── supabase_client.py      # Supabase client factory (Anon vs Admin)
    ├── auth_dependencies.py    # FastAPI Depends role guards (require_roles)
    └── SUPABASE_SETUP.md       # Database setup reference
```

---

## 2. Environment Settings Management (`config.py`)

Uses `pydantic-settings` to auto-detect and load system environment variables from `.env`:

```python
class Settings(BaseSettings):
    # App Configuration
    app_name: str = Field(default="SmartATS Backend", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    cors_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000", alias="CORS_ORIGINS")
    
    # JWT Security
    jwt_secret: str = Field(default="dev-secret-key-change-in-production-32chars", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    
    # Supabase Database
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_service_key: str = Field(default="", alias="SUPABASE_SERVICE_KEY")
    
    # Azure Cloud Services
    azure_storage_connection_string: str = Field(default="", alias="AZURE_STORAGE_CONNECTION_STRING")
    azure_service_bus_connection_string: str = Field(default="", alias="AZURE_SERVICE_BUS_CONNECTION_STRING")
    
    # AI & External APIs
    google_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")
    github_api_token: str = Field(default="", alias="GITHUB_API_TOKEN")
    apify_api_token: str = Field(default="", alias="APIFY_API_TOKEN")
    renidly_api_key: str = Field(default="", alias="RENIDLY_API_KEY")
```


---

## 3. Database Client Factory (`supabase_client.py`)

Provides distinct access modes based on operational security requirements:

```python
@lru_cache()
def get_supabase_client(settings: Settings, use_admin: bool = False) -> Client:
    """
    Returns cached Supabase client.
    - `use_admin=False`: Uses anon key (enforces RLS)
    - `use_admin=True`: Uses service role key (bypasses RLS for backend workers)
    """
    if use_admin:
        if not settings.supabase_service_key:
            raise ValueError("SUPABASE_SERVICE_KEY is required for admin mode")
        return create_client(settings.supabase_url, settings.supabase_service_key)
    
    return create_client(settings.supabase_url, settings.supabase_anon_key)
```

---

## 4. Role Dependency Guards (`auth_dependencies.py`)

```python
def require_roles(*allowed_roles: UserRole):
    """
    FastAPI dependency guard checking user JWT role.
    Example: Depends(require_roles("admin", "hr_manager", "tech_lead"))
    """
    def dependency(
        current_user: Annotated[AuthUser, Depends(get_current_user)],
    ) -> AuthUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted for this action"
            )
        return current_user
    return dependency
```

---

## 5. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when modifying system-wide settings, adding new environment variables, initializing Supabase database clients, updating FastAPI middleware, or configuring logging.

### What Problems Does This Skill Solve?
Provides single-source-of-truth configuration management, prevents service key leaks, enforces role guards, and ensures structured logging across the entire backend.

### Which Modules Depend On It?
All domain modules (`auth`, `ingestion`, `enrichment`) depend on `modules/shared/`.

### Which Files Should AI Modify vs Never Modify?
- **Modify**: `modules/shared/infrastructure/config.py`, `modules/shared/domain/supabase_models.py`.
- **Never Modify**: Do NOT leak `SUPABASE_SERVICE_KEY` or `JWT_SECRET` in public functions or client responses.

### Common Anti-Patterns & Implementation Mistakes:
- **Creating Uncached Clients**: Creating a new `create_client()` instance on every single HTTP request instead of reusing cached factory instances.
- **Bypassing `Settings`**: Using `os.getenv("KEY")` directly in business logic instead of accessing `settings.key` via `get_settings()` dependency injection.
