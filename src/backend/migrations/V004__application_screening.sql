-- =========================================================================
--  V004: Applicant screening questionnaire
--  Prerequisite: applications table (see "supabase guide.md")
--
--  Quantitative answers become typed columns so HR can filter on them and the
--  Fit Score can compare them against jobs_posting. Skill ratings vary per job,
--  so they live in jsonb. Consent is stored explicitly — it is legal evidence.
-- =========================================================================

ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS expected_salary_min  numeric(12,2),
    ADD COLUMN IF NOT EXISTS expected_salary_max  numeric(12,2),
    ADD COLUMN IF NOT EXISTS salary_currency      varchar(10)  NOT NULL DEFAULT 'VND',
    ADD COLUMN IF NOT EXISTS salary_basis         varchar(10),
    ADD COLUMN IF NOT EXISTS work_mode_pref       text[]       NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS availability_bucket  varchar(30),
    ADD COLUMN IF NOT EXISTS availability_date    date,
    ADD COLUMN IF NOT EXISTS experience_bucket    varchar(20),
    ADD COLUMN IF NOT EXISTS skill_ratings        jsonb        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS portfolio_url        text,
    ADD COLUMN IF NOT EXISTS proudest_project     text,
    ADD COLUMN IF NOT EXISTS motivation_reason    varchar(50),
    ADD COLUMN IF NOT EXISTS motivation_other     text,
    ADD COLUMN IF NOT EXISTS conflict_story       text,
    ADD COLUMN IF NOT EXISTS work_style           varchar(30),
    -- Defaults false so pre-existing rows stay valid; the form only ever writes true.
    ADD COLUMN IF NOT EXISTS consent_data_sharing boolean      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS consent_at           timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_app_salary_range') THEN
        ALTER TABLE public.applications ADD CONSTRAINT ck_app_salary_range CHECK (
            expected_salary_min IS NULL
            OR expected_salary_max IS NULL
            OR expected_salary_max >= expected_salary_min
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_app_salary_basis') THEN
        ALTER TABLE public.applications ADD CONSTRAINT ck_app_salary_basis CHECK (
            salary_basis IS NULL OR salary_basis IN ('gross', 'net')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_app_availability') THEN
        ALTER TABLE public.applications ADD CONSTRAINT ck_app_availability CHECK (
            availability_bucket IS NULL
            OR availability_bucket IN ('immediate', 'two_weeks', 'one_month', 'other')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_app_experience') THEN
        ALTER TABLE public.applications ADD CONSTRAINT ck_app_experience CHECK (
            experience_bucket IS NULL
            OR experience_bucket IN ('under_1', '1_3', '3_5', 'over_5')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_app_motivation') THEN
        ALTER TABLE public.applications ADD CONSTRAINT ck_app_motivation CHECK (
            motivation_reason IS NULL
            OR motivation_reason IN ('growth', 'promotion', 'pivot', 'other')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_app_work_style') THEN
        ALTER TABLE public.applications ADD CONSTRAINT ck_app_work_style CHECK (
            work_style IS NULL
            OR work_style IN ('independent', 'collaborative', 'structured')
        );
    END IF;
END $$;

-- -------------------------------------------------------------------------
--  candidates.education_level
--  The form was writing its education level into graduation_year, which is a
--  different thing. Give it its own column and backfill the misplaced values.
-- -------------------------------------------------------------------------

ALTER TABLE public.candidates
    ADD COLUMN IF NOT EXISTS education_level varchar(50);

UPDATE public.candidates
SET education_level = graduation_year,
    graduation_year = NULL
WHERE education_level IS NULL
  AND graduation_year IN (
      'high-school', 'bachelors-completed', 'masters-doctorate',
      'currently-enrolled', 'other'
  );

CREATE INDEX IF NOT EXISTS idx_applications_salary
    ON public.applications (expected_salary_min, expected_salary_max);

CREATE INDEX IF NOT EXISTS idx_applications_experience
    ON public.applications (experience_bucket);

CREATE INDEX IF NOT EXISTS idx_applications_skill_ratings
    ON public.applications USING gin (skill_ratings);
