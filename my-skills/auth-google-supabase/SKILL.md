---
name: auth-google-supabase
description: Google OAuth 2.0 login, JWT access/refresh token management, and Supabase-based role verification for SmartATS
version: 1.0.0
tech_stack:
  - FastAPI
  - Python 3.11+
  - Google OAuth 2.0
  - PyJWT
  - Supabase
when_to_use:
  - "implement Google OAuth login"
  - "configure JWT token generation and validation"
  - "set up Supabase role-based access control"
  - "verify admin roles from Supabase users table"
  - "implement token refresh flow"
---

# Auth Module: Google OAuth + JWT + Supabase RBAC

## Overview

Handles authentication and authorization for SmartATS. Users log in with Google OAuth 2.0, the server verifies the credential, resolves their role from Supabase (or .env fallback), and issues JWT access + refresh tokens.

## Architecture

```
modules/auth/
├── adapters/
│   └── routes.py              # POST /api/auth/google, POST /api/auth/refresh
├── application/
│   ├── auth_service.py        # Login orchestrator + role resolution
│   └── linkedin_scraper.py    # Standalone LinkedIn scraper (Renidly API)
├── domain/
│   └── models.py              # AuthUser, token request/response Pydantic models
└── infra/
    ├── google_verifier.py     # Google OAuth token verification
    └── jwt_service.py         # JWT encode/decode
```

## Flow

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
   │                           │◄── { role: 'admin' } ─────────┤
   │                           │                                │
   │                           ├── create JWT (access+refresh)  │
   │◄── { accessToken,         │                                │
   │       refreshToken,       │                                │
   │       user } ─────────────┤                                │
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/google` | None | Exchange Google credential for JWT tokens |
| POST | `/api/auth/refresh` | None | Refresh access token using refresh token |

### POST /api/auth/google

**Request:**
```json
{ "credential": "google_oauth_credential_string" }
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "google_sub_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "picture": "https://..."
  }
}
```

**Error (401):**
```json
{ "detail": "Authentication failed: Email 'user@example.com' not found in system." }
```

## Role Resolution (Two Modes)

### 1. Supabase Mode (Production)
Queries `public.users` table for the user's email. Only allows login if:
- Email exists in the `users` table
- `is_active = true`
- `role = 'admin'`

### 2. Env Fallback Mode (Development)
- `ADMIN_EMAILS`: comma-separated list → role = `admin`
- `RECRUITER_EMAIL_DOMAINS`: comma-separated domains → role = `recruiter`
- Everything else → role = `interviewer`

## Token Lifecycle

| Token | Expiry | Storage | Usage |
|-------|--------|---------|-------|
| Access Token | `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60) | Memory/HTTP header | Bearer token for API calls |
| Refresh Token | `REFRESH_TOKEN_EXPIRE_DAYS` (default 7) | HTTP-only cookie or localStorage | Get new access token |

## Key Files

| File | Responsibility |
|------|----------------|
| `modules/auth/infra/google_verifier.py` | Uses `google-auth` lib to verify OAuth2 token; returns id/email/name/picture |
| `modules/auth/infra/jwt_service.py` | Creates and decodes JWT with `sub`, `email`, `name`, `role`, `type`, `exp` claims |
| `modules/auth/application/auth_service.py` | Orchestrates login: verify → resolve role → create tokens |
| `modules/auth/adapters/routes.py` | FastAPI router with dependency injection |
| `modules/shared/infrastructure/auth_dependencies.py` | `require_roles()` dependency guard for protected routes |
| `modules/auth/domain/models.py` | `AuthUser`, `GoogleLoginRequest`, `AuthTokenResponse`, etc. |

## Environment Variables

```bash
GOOGLE_CLIENT_ID=           # Google OAuth client ID
GOOGLE_CLIENT_SECRET=       # Google OAuth client secret
JWT_SECRET=                 # At least 32 chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
ADMIN_EMAILS=               # Comma-separated (fallback mode)
RECRUITER_EMAIL_DOMAINS=    # Comma-separated (fallback mode)
SUPABASE_URL=               # For Supabase mode
SUPABASE_SERVICE_KEY=       # Service role key for admin queries
```

## Usage Example

```typescript
// Frontend: Login button handler
import { useGoogleLogin } from '@react-oauth/google';
import { api } from '@/services/httpClient';

const login = useGoogleLogin({
  onSuccess: async (codeResponse) => {
    const { accessToken, refreshToken, user } = await api.post(
      '/api/auth/google',
      { credential: codeResponse.code }
    );
    // Store tokens + user in AuthContext
  }
});
```

```python
# Backend: Protect a route
from modules.shared.infrastructure.auth_dependencies import require_roles

@router.get("/protected")
def protected_route(
    current_user: Annotated[AuthUser, Depends(require_roles("admin"))]
):
    return {"message": f"Hello admin {current_user.email}"}
```

## Security Notes

1. Google credential is verified server-side with `google.oauth2.id_token.verify_oauth2_token()`
2. Always use `SUPABASE_SERVICE_KEY` (not anon key) for role queries
3. Check `email_verified` flag from Google before allowing login
4. JWT secret must be at least 32 characters long
5. Access tokens are short-lived (60 min); refresh tokens rotated on each refresh
