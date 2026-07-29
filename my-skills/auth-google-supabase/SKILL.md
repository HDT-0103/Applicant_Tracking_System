---
name: auth-google-supabase
description: Google OAuth 2.0 login, JWT access/refresh token management, and Supabase role verification (Admin, HR Manager, Tech Lead, Recruiter, Interviewer) for SmartATS
version: 2.0.0
author: SmartATS Security & Auth Team
tech_stack:
  - FastAPI
  - Python 3.11+
  - Google OAuth 2.0
  - PyJWT
  - Supabase (PostgreSQL)
when_to_use:
  - "implement or update Google OAuth login flow"
  - "configure JWT token generation, verification, or refresh"
  - "set up Supabase role-based authorization"
  - "verify permissions for Admin, HR Manager, Tech Lead, Recruiter, Interviewer"
  - "protect FastAPI endpoints with role guards"
---

# Auth Module: Google OAuth + JWT + Supabase RBAC

## 1. Overview & Architecture

Handles authentication and authorization for SmartATS. Users log in with Google OAuth 2.0, the server verifies the credential with Google, resolves their role from Supabase `public.users` table, and issues signed JWT access + refresh tokens.

```
src/backend/modules/auth/
├── adapters/
│   └── routes.py              # POST /api/auth/google, POST /api/auth/refresh
├── application/
│   └── auth_service.py        # Login orchestrator + role resolution
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
   │                           │◄── { role: 'hr_manager' } ────┤
   │                           │                                │
   │                           ├── create JWT (access+refresh)  │
   │◄── { accessToken,         │                                │
   │       refreshToken,       │                                │
   │       user } ─────────────┤                                │
```

---

## 3. Supported Roles & Resolution Modes

### Supported Roles (`UserRole`)
- `admin`: System administrator (Full access).
- `hr` / `hr_manager`: Human Resources Manager (Ingestion, Enrichment, Job posting, Offers).
- `tech_lead`: Technical Lead / Hiring Manager (Candidate evaluation, Skill Matrix, Interviews).
- `recruiter`: Talent Sourcing Specialist (Ingestion, Sourcing, Screening).
- `interviewer`: Technical Interviewer (PII-masked feedback submission).

### 1. Supabase Mode (Production)
Queries `public.users` table for user's email. Authenticates if:
- Email exists in `users` table
- `is_active = true`
- `role` is in permitted role set (`admin`, `hr`, `hr_manager`, `tech_lead`, `recruiter`, `interviewer`).

### 2. Env Fallback Mode (Development)
- `ADMIN_EMAILS`: comma-separated list → role = `admin`
- `RECRUITER_EMAIL_DOMAINS`: comma-separated domains → role = `recruiter`
- Default fallback → role = `interviewer`

---

## 4. Token Lifecycle & Specifications

| Token | Expiry Config | Storage | Usage |
|-------|---------------|---------|-------|
| Access Token | `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60m) | Memory / Authorization Header | Bearer token for API calls |
| Refresh Token | `REFRESH_TOKEN_EXPIRE_DAYS` (default 7d) | localStorage / Cookie | Refresh expired access tokens |

---

## 5. Standard Code Usage

```python
# Protect a backend route by role
from modules.shared.infrastructure.auth_dependencies import require_roles

@router.get("/api/v1/protected")
def protected_route(
    current_user: Annotated[AuthUser, Depends(require_roles("admin", "hr_manager", "tech_lead"))]
):
    return {"message": f"Welcome {current_user.name} ({current_user.role})"}
```

---

## 6. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when editing login endpoints, JWT signing/decoding logic, role check dependencies, or Google OAuth integration.

### What Problems Does This Skill Solve?
Provides secure user identity verification, prevents unauthorized API access, and maps Google logins to database roles.

### Which Modules Depend On It?
- `modules/ingestion` (Requires `recruiter`, `hr_manager`, `admin`)
- `modules/enrichment` (Requires `recruiter`, `hr_manager`, `tech_lead`, `admin`)
- `modules/shared` (Provides `auth_dependencies.py`)

### Other Skills to Load Together:
- `security-governance`
- `shared-infrastructure`
- `backend-api-standards`

### Which Files Should AI Modify vs Never Modify?
- **Modify**: `modules/auth/application/auth_service.py`, `modules/auth/domain/models.py`, `modules/auth/adapters/routes.py`.
- **Never Modify**: `modules/auth/infra/google_verifier.py` (unless upgrading Google Auth SDK).

### Common Anti-Patterns & Mistakes to Avoid:
- **Ignoring Token Expiry**: Client applications must gracefully handle 401s by calling `/api/auth/refresh`.
- **Hardcoding Secret Keys**: Never hardcode JWT secret strings in source files.
- **Bypassing Role Check**: Never disable `require_roles` on protected routes.
