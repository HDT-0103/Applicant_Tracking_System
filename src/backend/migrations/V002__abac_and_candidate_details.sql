-- =========================================================================
--  V002: ABAC roles + candidate extended fields
--  Prerequisite: V001 (base schema from user design) must be applied first.
-- =========================================================================

-- 1. Extend the role_type enum with tech_lead and hr
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'tech_lead';
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'hr';

-- 2. Candidate extended details (phone, address, salary)
CREATE TABLE IF NOT EXISTS candidate_details (
    id              uuid DEFAULT gen_random_uuid(),
    resume_id       uuid NOT NULL,
    phone           varchar(20),
    address         text,
    salary_expectation numeric(12,2),
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    CONSTRAINT pk_candidate_detail PRIMARY KEY (id),
    CONSTRAINT fk_candidate_details_resume
        FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_candidate_details_resume_id
    ON candidate_details(resume_id);

-- 3. ABAC field-level access policies (optional — engine uses hardcoded policy by default)
CREATE TABLE IF NOT EXISTS abac_policies (
    id              uuid DEFAULT gen_random_uuid(),
    role            varchar(50) NOT NULL,
    field_path      varchar(255) NOT NULL,
    strategy        varchar(50) NOT NULL DEFAULT 'passthrough',
    created_at      timestamptz DEFAULT now(),

    CONSTRAINT pk_abac_policy PRIMARY KEY (id),
    CONSTRAINT uq_abac_role_field UNIQUE (role, field_path)
);

-- Seed default policies for tech_lead role
INSERT INTO abac_policies (role, field_path, strategy) VALUES
    ('tech_lead', 'full_name',           'redact'),
    ('tech_lead', 'email',               'redact'),
    ('tech_lead', 'phone',               'redact'),
    ('tech_lead', 'address',             'redact'),
    ('tech_lead', 'salary_expectation',  'redact')
ON CONFLICT (role, field_path) DO NOTHING;
