-- Migration script for Supabase Database
-- Copy and run this in Supabase's SQL Editor to set up tables for Epic 6

-- 1. Alter role_type enum to include 'interviewer'
-- In PostgreSQL, altering type in a transaction requires care.
-- We can execute this safely. If it already exists, this statement will fail,
-- so we can run it separately or catch/ignore it.
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'interviewer';

-- 2. Alter users table to add password_hash (for traditional login/register)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;

-- 2b. (Epic 6 / Auth Redesign) Account approval flag.
-- Public registration (HR/recruiter) sets this in AuthService; the Admin
-- Dashboard (Epic 6) can later toggle it to gate/suspend accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create abac_policies table
CREATE TABLE IF NOT EXISTS abac_policies (
    id UUID DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL,              -- e.g., 'interviewer', 'recruiter'
    resource VARCHAR(100) NOT NULL,          -- e.g., 'resume', 'candidate_profile'
    field_name VARCHAR(100) NOT NULL,        -- e.g., 'email', 'phone', 'expected_salary'
    is_masked BOOLEAN DEFAULT TRUE,
    masking_pattern VARCHAR(50) DEFAULT '***',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT pk_abac_policy PRIMARY KEY (id),
    CONSTRAINT uq_role_resource_field UNIQUE (role, resource, field_name)
);

-- 4. Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_jti VARCHAR(255) UNIQUE NOT NULL,
    user_agent VARCHAR(512),
    ip_address VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT pk_user_session PRIMARY KEY (id),
    CONSTRAINT fk_user_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(token_jti);

-- 5. Create llm_usage_logs table
CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID,
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(10, 6) DEFAULT 0.000000,
    operation_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT pk_llm_usage_log PRIMARY KEY (id),
    CONSTRAINT fk_llm_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Create api_rate_limits table
CREATE TABLE IF NOT EXISTS api_rate_limits (
    provider VARCHAR(50) NOT NULL,
    rate_limit_total INTEGER,
    rate_limit_remaining INTEGER,
    rate_limit_reset TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT pk_api_rate_limit PRIMARY KEY (provider)
);

-- 7. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    candidate_uuid UUID,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT pk_audit_log PRIMARY KEY (id),
    CONSTRAINT fk_audit_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_candidate_uuid ON audit_logs(candidate_uuid);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 8. Seed default ABAC policies for 'interviewer' (or tech lead) role PII masking
INSERT INTO abac_policies (role, resource, field_name, is_masked, masking_pattern)
VALUES 
    ('interviewer', 'resume', 'email', TRUE, '***'),
    ('interviewer', 'resume', 'phone', TRUE, '***'),
    ('interviewer', 'resume', 'expected_salary', TRUE, '***')
ON CONFLICT (role, resource, field_name) DO NOTHING;
