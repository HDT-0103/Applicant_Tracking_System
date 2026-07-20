-- =====================================================================
-- SmartATS · Supabase migration for Admin + Login/Register
-- Paste toàn bộ file này vào Supabase Studio > SQL Editor > Run.
-- Idempotent + tự vá cột: dùng CREATE TABLE (tối thiểu) rồi ADD COLUMN IF NOT EXISTS
-- cho từng cột code cần -> chạy được kể cả khi bảng đã tồn tại với cấu trúc KHÁC/thiếu cột.
-- Không đặt tên constraint tường minh -> không đụng constraint có sẵn của Supabase.
-- =====================================================================

-- 0) Extension cần cho gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Enum role_type: đảm bảo tồn tại và đủ 4 giá trị (chữ thường)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
    CREATE TYPE role_type AS ENUM ('candidate', 'recruiter', 'admin', 'interviewer');
  END IF;
END $$;
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'candidate';
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'recruiter';
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'interviewer';
-- (Nếu Supabase báo "ALTER TYPE ... ADD VALUE cannot run inside a transaction",
--  chạy riêng 4 dòng ALTER TYPE ở trên trước, rồi Run phần còn lại.)

-- 2) users: bổ sung 2 cột mới cho login/register + duyệt tài khoản
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) user_sessions  (BẮT BUỘC — get_current_user() query bảng này mỗi request)
CREATE TABLE IF NOT EXISTS user_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_jti VARCHAR(255);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT FALSE;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_sessions_token_jti ON user_sessions(token_jti);

-- 4) audit_logs (số NHIỀU — code dùng tên này; 'audit_log' số ít của Supabase là bảng khác, để nguyên)
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS candidate_uuid UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 5) llm_usage_logs (tab AI & Vector)
CREATE TABLE IF NOT EXISTS llm_usage_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS model_name VARCHAR(100);
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER DEFAULT 0;
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS completion_tokens INTEGER DEFAULT 0;
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0;
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10, 6) DEFAULT 0.000000;
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS operation_type VARCHAR(100);
ALTER TABLE llm_usage_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 6) api_rate_limits (tab Infrastructure)
CREATE TABLE IF NOT EXISTS api_rate_limits (provider VARCHAR(50) PRIMARY KEY);
ALTER TABLE api_rate_limits ADD COLUMN IF NOT EXISTS rate_limit_total INTEGER;
ALTER TABLE api_rate_limits ADD COLUMN IF NOT EXISTS rate_limit_remaining INTEGER;
ALTER TABLE api_rate_limits ADD COLUMN IF NOT EXISTS rate_limit_reset TIMESTAMPTZ;
ALTER TABLE api_rate_limits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7) abac_policies: bảng đã có sẵn (thiết kế khác) -> vá đủ cột code cần rồi seed.
--    Lưu ý: bảng cũ có cột field_path NOT NULL (thiết kế ABAC của Data Engineer),
--    nên seed phải điền field_path. Các cột dưới đây dùng cho trang Admin (Epic 6).
CREATE TABLE IF NOT EXISTS abac_policies (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS resource VARCHAR(100);
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS field_name VARCHAR(100);
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS field_path VARCHAR(255); -- cột cũ NOT NULL; đảm bảo tồn tại kể cả khi bảng tạo mới
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS is_masked BOOLEAN DEFAULT TRUE;
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS masking_pattern VARCHAR(50) DEFAULT '***';
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE abac_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO abac_policies (role, resource, field_name, field_path, is_masked, masking_pattern)
SELECT v.role, v.resource, v.field_name, v.resource || '.' || v.field_name, v.is_masked, v.masking_pattern
FROM (VALUES
    ('interviewer', 'resume', 'email',           TRUE, '***'),
    ('interviewer', 'resume', 'phone',           TRUE, '***'),
    ('interviewer', 'resume', 'expected_salary', TRUE, '***')
) AS v(role, resource, field_name, is_masked, masking_pattern)
WHERE NOT EXISTS (
    SELECT 1 FROM abac_policies p
    WHERE p.role = v.role AND p.resource = v.resource AND p.field_name = v.field_name
);

-- 8) Seed tài khoản Admin (hash PBKDF2 của mật khẩu 'Admin@123' — ĐỔI sau khi đăng nhập)
INSERT INTO users (name, email, role, is_approved, password_hash)
SELECT 'System Admin', 'admin@smartats.com', 'admin'::role_type, TRUE,
       '3a29e984dbf953f651b6b5b7fb1644a6$04bf311eec7a4e10e243b786bb34165e2ae43e6d4f254b33089732831bfa6b63'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@smartats.com');

-- Xong. Đăng nhập:  admin@smartats.com  /  Admin@123
