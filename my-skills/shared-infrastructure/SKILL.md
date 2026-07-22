---
name: shared-infrastructure
description: Shared infrastructure layer — FastAPI app config, Supabase client, CORS, auth dependencies, and structured logging
version: 1.0.0
tech_stack:
  - FastAPI
  - Python 3.11+
  - Supabase (PostgreSQL)
  - Structlog
  - Pydantic Settings
when_to_use:
  - "configure FastAPI application settings"
  - "set up Supabase client (anon + admin)"
  - "implement auth dependency injection for route protection"
  - "configure CORS for development"
  - "set up structured logging with structlog"
---

# Shared Infrastructure Module

## Overview

The shared module provides cross-cutting infrastructure used by all other modules: application configuration, database client, authentication dependencies, and logging setup.

## Structure

```
modules/shared/
├── domain/
│   └── supabase_models.py      # Supabase table row models (User, RoleType)
└── infrastructure/
    ├── config.py               # Pydantic Settings (all env vars)
    ├── supabase_client.py      # Supabase client factory
    ├── auth_dependencies.py    # FastAPI Depends for role verification
    └── SUPABASE_SETUP.md       # Supabase setup guide
```

## Configuration (`config.py`)

Uses `pydantic-settings` for type-safe environment variable loading:

```python
class Settings(BaseSettings):
    # App
    app_name: str = "SmartATS"
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    
    # Auth
    admin_email_list: list[str] = []
    recruiter_domain_list: list[str] = []
    google_client_id: str = ""
    
    # Database
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    
    # Azure
    azure_storage_connection_string: str = ""
    azure_service_bus_connection_string: str = ""
    
    # APIs
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    github_api_token: str = ""
    apify_api_token: str = ""
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
    
    model_config = SettingsConfigDict(env_file=".env")
```

## Supabase Client (`supabase_client.py`)

Two client modes:

```python
def get_supabase_client(settings: Settings, use_admin: bool = False):
    if use_admin:
        return create_client(settings.supabase_url, settings.supabase_service_key)
    return create_client(settings.supabase_url, settings.supabase_anon_key)
```

- **Admin client** (service key): Used for role verification (bypasses RLS)
- **Anon client**: Used for public operations

## Auth Dependencies (`auth_dependencies.py`)

```python
def require_roles(*roles: str):
    """
    Dependency factory. Usage:
        Depends(require_roles("admin"))
        Depends(require_roles("recruiter", "admin"))
    """
    async def dependency(
        authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    ) -> AuthUser:
        # 1. Extract Bearer token
        # 2. Decode JWT via JwtService
        # 3. Check user.role in allowed roles
        # 4. Return AuthUser or raise 403
    return dependency
```

## CORS Configuration

```python
cors_kwargs = {
    "allow_origins": settings.cors_origin_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.app_env.lower() == "development":
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
```

## Logging

Structured JSON logging with structlog:

```python
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
```

## Supabase Tables

The `users` table schema (defined in `SUPABASE_SETUP.md`):

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'interviewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## FastAPI App Entry Point (`apps/main.py`)

```python
app = FastAPI(title=settings.app_name, version="4.2.1")
app.add_middleware(CORSMiddleware, **cors_kwargs)
app.include_router(auth_router)
app.include_router(ingestion_router)
app.include_router(azure_ingestion_router)
app.include_router(enrichment_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.app_name}
```
