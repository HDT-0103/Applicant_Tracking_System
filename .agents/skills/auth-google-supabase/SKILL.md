---
name: auth-google-supabase
description: Google OAuth 2.0 login, JWT access/refresh token management, and Supabase role verification (Admin, HR, HR Manager, Tech Lead, Recruiter, Interviewer) for SmartATS
version: 2.0.0
author: SmartATS Security & Auth Team
tech_stack:
  - FastAPI
  - Python 3.11+
  - Google OAuth 2.0 (`google-auth`)
  - PyJWT
  - Supabase (PostgreSQL)
when_to_use:
  - "implement or update Google OAuth login flow"
  - "configure JWT token generation, verification, or refresh"
  - "set up Supabase role-based authorization"
  - "verify permissions for Admin, HR, HR Manager, Tech Lead, Recruiter, Interviewer"
  - "protect FastAPI endpoints with role guards"
---

# Auth Module: Google OAuth + JWT + Supabase RBAC

## 1. Overview & Architecture

Handles authentication and authorization for SmartATS. Users log in with Google OAuth 2.0, the server verifies the credential with Google, resolves their role from Supabase `public.users` table (or `.env` fallback), and issues signed JWT access + refresh tokens.

```
src/backend/modules/auth/
├── adapters/
│   └── routes.py              # POST /api/auth/google, POST /api/auth/refresh
├── application/
│   └── auth_service.py        # Login orchestrator + Supabase/env role resolution
├── domain/
│   └── models.py              # AuthUser, UserRole, token request/response models
└── infra/
    ├── google_verifier.py     # Google OAuth token verification
    └── jwt_service.py         # JWT encode/decode
```

---

## 2. Authentication Flow

```
Frontend                     Backend                        Supabase / Google
   │                           │                                │
   ├─ Google OAuth popup ─────►│                                │
   │                           │                                │
   │◄── credential ────────────┤                                │
   │                           │                                │
   ├─ POST /api/auth/google ──►│                                │
   │   { credential }          │                                │
   │                           ├── verify_oauth2_token() ──────►│ Google
   │                           │◄── user profile ──────────────┤
   │                           │                                │
   │                           ├── query users table ──────────►│ Supabase
   │                           │◄── { role: 'hr' / 'tech_lead' }┤
   │                           │                                │
   │                           ├── create JWT (access+refresh)  │
   │◄── { accessToken,         │                                │
   │       refreshToken,       │                                │
   │       user } ─────────────┤                                │
```

---

## 3. Supported Roles & Resolution Modes

### Supported Roles (`UserRole`)
- `admin`: System administrator.
- `hr` / `hr_manager`: Human Resources Manager.
- `tech_lead`: Technical Lead / Hiring Manager.
- `recruiter`: Talent Sourcing Specialist.
- `interviewer`: Technical Interviewer.

### 1. Supabase Role Resolution (`resolve_role_from_supabase`)
Queries `public.users` table by email. Authenticates if:
- Email exists in `users` table
- `is_active = true`
- `role` is in permitted role set (`allowed_roles = {'hr', 'tech_lead'}`).

### 2. Env Fallback Resolution (`resolve_role`)
If Supabase is disabled or auto-detected as non-configured:
- `ADMIN_EMAILS`: comma-separated list of emails → role = `admin`
- `RECRUITER_EMAIL_DOMAINS`: comma-separated domains → role = `recruiter`
- Default fallback → role = `interviewer`

---

## 4. Token Lifecycle & Specifications

| Token | Expiry Config | Storage | Usage |
|-------|---------------|---------|-------|
| Access Token | `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60m) | localStorage (`smartats_access_token`) | Bearer token for API calls |
| Refresh Token | `REFRESH_TOKEN_EXPIRE_DAYS` (default 7d) | localStorage (`smartats_refresh_token`) | Refresh expired access tokens via `/api/auth/refresh` |

---

## 5. Standard Code Usage

```python
# Protect a backend route by role
from modules.shared.infrastructure.auth_dependencies import require_roles

@router.post("/api/enrichment/{candidate_uuid}/sync")
def sync_candidate(
    candidate_uuid: str,
    current_user: Annotated[AuthUser, Depends(require_roles("recruiter", "admin", "hr", "hr_manager", "tech_lead"))]
):
    return {"message": f"Sync started for {candidate_uuid} by {current_user.name}"}
```

---

## 6. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when editing login endpoints, JWT signing/decoding logic, role check dependencies, or Google OAuth integration.

### What Problems Does This Skill Solve?
Provides secure user identity verification, prevents unauthorized API access, and maps Google logins to database roles.

### Which Modules Depend On It?
- `modules/ingestion` (Requires `recruiter`, `admin`, `hr`, `hr_manager`, `tech_lead`)
- `modules/enrichment` (Requires `recruiter`, `admin`, `hr`, `hr_manager`, `tech_lead`)
- `modules/shared` (Provides `auth_dependencies.py`)

### Other Skills to Load Together:
- `security-governance`
- `shared-infrastructure`
- `backend-api-standards`

### Which Files Should AI Modify vs Never Modify?
- **Modify**: `modules/auth/application/auth_service.py`, `modules/auth/domain/models.py`, `modules/auth/adapters/routes.py`, `src/frontend/contexts/AuthContext.tsx`.
- **Never Modify**: `modules/auth/infra/google_verifier.py` (unless upgrading Google Auth SDK).

### Common Anti-Patterns & Mistakes to Avoid:
- **Ignoring Token Expiry**: Client applications must gracefully handle 401s by calling `/api/auth/refresh`.
- **Hardcoding Secret Keys**: Never hardcode JWT secret strings in source files.
- **Bypassing Role Check**: Never disable `require_roles` on protected routes.

