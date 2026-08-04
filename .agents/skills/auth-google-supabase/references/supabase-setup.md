# Supabase Auth Setup

## 1. Users Table

Run in Supabase SQL Editor:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'interviewer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

-- Seed admin
INSERT INTO users (email, name, role, is_active)
VALUES ('admin@example.com', 'Admin', 'admin', true);
```

## 2. Env Config

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...           # Anon/public key
SUPABASE_SERVICE_KEY=eyJ...         # Service role key (for admin queries)
```

## 3. How It Works

- `AuthService.resolve_role_from_supabase()` queries the `users` table
- Only allows login if email exists AND role = 'admin' AND is_active = true
- Uses `SUPABASE_SERVICE_KEY` (service role) to bypass RLS
