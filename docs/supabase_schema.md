# CẤU TRÚC CÁC BẢNG TRONG SUPABASE

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  role USER-DEFINED NOT NULL,
  picture text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  password_hash character varying,
  is_approved boolean NOT NULL DEFAULT false,
  -- V009: công ty của người dùng nội bộ, khai lúc đăng ký / onboarding.
  -- NULL = chưa hoàn tất hồ sơ (frontend đưa tới /onboarding/company).
  company_name character varying,
  company_website character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.candidates (
  uuid character varying NOT NULL,
  full_name character varying,
  github_username character varying,
  linkedin_url text,
  resume_text text,
  status character varying NOT NULL DEFAULT 'CREATED'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cv_file_path text,
  email character varying,
  current_location character varying,
  current_company character varying,
  pronouns character varying,
  custom_pronouns character varying,
  github_url text,
  portfolio_url text,
  website_url text,
  university character varying,
  faculty_program text,
  graduation_year character varying,
  age_group character varying,
  gender_identity character varying,
  race ARRAY NOT NULL DEFAULT '{}'::text[],
  military_status character varying,
  disability_status character varying,
  phone character varying,
  address text,
  salary_expectation numeric,
  education_level character varying,
  CONSTRAINT candidates_pkey PRIMARY KEY (uuid)
);
CREATE TABLE public.resumes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying NOT NULL,
  filename character varying,
  file_path text,
  text_content text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT resumes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_resume_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid)
);
CREATE TABLE public.interviewers (
  id character varying NOT NULL,
  name character varying NOT NULL,
  email character varying NOT NULL DEFAULT ''::character varying,
  job_title character varying NOT NULL,
  initials character varying NOT NULL,
  color character varying NOT NULL,
  cal_connected boolean NOT NULL DEFAULT false,
  calendar_api_key text,
  calendar_id character varying NOT NULL DEFAULT 'primary'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT interviewers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.confirmed_slots (
  id character varying NOT NULL,
  candidate_uuid character varying NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  interviewer_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  calendar_event_id text,
  email_notified boolean NOT NULL DEFAULT false,
  slack_notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT confirmed_slots_pkey PRIMARY KEY (id),
  CONSTRAINT fk_confirmed_slot_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid)
);
CREATE TABLE public.abac_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role character varying NOT NULL,
  field_path character varying NOT NULL,
  strategy character varying NOT NULL DEFAULT 'passthrough'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resource character varying,
  field_name character varying,
  is_masked boolean DEFAULT true,
  masking_pattern character varying DEFAULT '***'::character varying,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT abac_policies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cv_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewer_role USER-DEFINED NOT NULL,
  decision USER-DEFINED NOT NULL DEFAULT 'pending'::review_decision,
  review_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cv_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT fk_cv_review_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid),
  CONSTRAINT fk_cv_review_reviewer FOREIGN KEY (reviewer_id) REFERENCES public.users(id)
);
CREATE TABLE public.github_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying NOT NULL UNIQUE,
  public_repos_count integer NOT NULL DEFAULT 0,
  top_languages jsonb NOT NULL DEFAULT '{}'::jsonb,
  readme_content text,
  repos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT github_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT fk_github_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid)
);
CREATE TABLE public.linkedin_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying NOT NULL UNIQUE,
  full_name character varying,
  headline text,
  profile_url text,
  avatar_url text,
  experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  educations jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT fk_linkedin_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid)
);
CREATE TABLE public.enrichment_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying NOT NULL UNIQUE,
  enrichment_status USER-DEFINED NOT NULL DEFAULT 'QUEUED'::enrichment_status,
  match_confidence_score double precision,
  score_increase double precision,
  skill_matrix jsonb,
  semantic_tags ARRAY NOT NULL DEFAULT '{}'::text[],
  updated_at timestamp with time zone,
  skills ARRAY NOT NULL DEFAULT '{}'::text[],
  summary text,
  experience text,
  github text,
  linkedin text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT enrichment_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT fk_enrichment_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid)
);
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  token_jti character varying,
  user_agent character varying,
  ip_address character varying,
  expires_at timestamp with time zone,
  is_revoked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action character varying,
  candidate_uuid uuid,
  ip_address character varying,
  user_agent character varying,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.llm_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  model_name character varying,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost numeric DEFAULT 0.000000,
  operation_type character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT llm_usage_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.api_rate_limits (
  provider character varying NOT NULL,
  rate_limit_total integer,
  rate_limit_remaining integer,
  rate_limit_reset timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (provider)
);
CREATE TABLE public.jobs_posting (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_title character varying NOT NULL,
  department character varying,
  location character varying,
  seniority_level character varying,
  employment_type character varying,
  work_mode character varying,
  target_openings integer,
  salary_min numeric,
  salary_max numeric,
  must_have_skills ARRAY NOT NULL DEFAULT '{}'::text[],
  nice_to_have_skills ARRAY NOT NULL DEFAULT '{}'::text[],
  description text,
  key_responsibilities text,
  requirements text,
  nice_to_have_qualifications text,
  status character varying NOT NULL DEFAULT 'DRAFT'::character varying CHECK (status::text = ANY (ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying, 'CLOSED'::character varying, 'ARCHIVED'::character varying]::text[])),
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_saved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT jobs_posting_pkey PRIMARY KEY (id),
  CONSTRAINT fk_jobs_posting_created_by FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.universities (
  id bigint NOT NULL DEFAULT nextval('universities_id_seq'::regclass),
  name text NOT NULL,
  country text NOT NULL,
  alpha_two_code character varying,
  state_province text,
  domains ARRAY,
  web_pages ARRAY,
  CONSTRAINT universities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying NOT NULL,
  job_posting_id uuid NOT NULL,
  resume_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'SUBMITTED'::character varying CHECK (status::text = ANY (ARRAY['SUBMITTED'::character varying::text, 'SCREENING'::character varying::text, 'INTERVIEW'::character varying::text, 'OFFER'::character varying::text, 'HIRED'::character varying::text, 'REJECTED'::character varying::text, 'WITHDRAWN'::character varying::text])),
  cover_letter text,
  work_authorization boolean,
  office_attendance boolean,
  referral_source character varying,
  preferred_talent_network boolean,
  additional_information text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expected_salary_min numeric,
  expected_salary_max numeric,
  salary_currency character varying NOT NULL DEFAULT 'VND'::character varying,
  salary_basis character varying CHECK (salary_basis IS NULL OR (salary_basis::text = ANY (ARRAY['gross'::character varying, 'net'::character varying]::text[]))),
  work_mode_pref ARRAY NOT NULL DEFAULT '{}'::text[],
  availability_bucket character varying CHECK (availability_bucket IS NULL OR (availability_bucket::text = ANY (ARRAY['immediate'::character varying, 'two_weeks'::character varying, 'one_month'::character varying, 'other'::character varying]::text[]))),
  availability_date date,
  experience_bucket character varying CHECK (experience_bucket IS NULL OR (experience_bucket::text = ANY (ARRAY['under_1'::character varying, '1_3'::character varying, '3_5'::character varying, 'over_5'::character varying]::text[]))),
  skill_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  portfolio_url text,
  proudest_project text,
  motivation_reason character varying CHECK (motivation_reason IS NULL OR (motivation_reason::text = ANY (ARRAY['growth'::character varying, 'promotion'::character varying, 'pivot'::character varying, 'other'::character varying]::text[]))),
  motivation_other text,
  conflict_story text,
  work_style character varying CHECK (work_style IS NULL OR (work_style::text = ANY (ARRAY['independent'::character varying, 'collaborative'::character varying, 'structured'::character varying]::text[]))),
  consent_data_sharing boolean NOT NULL DEFAULT false,
  consent_at timestamp with time zone,
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT fk_application_candidate FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(uuid),
  CONSTRAINT fk_application_job_posting FOREIGN KEY (job_posting_id) REFERENCES public.jobs_posting(id),
  CONSTRAINT fk_application_resume FOREIGN KEY (resume_id) REFERENCES public.resumes(id)
);
CREATE TABLE public.embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrichment_profile_id uuid NOT NULL,
  source_type character varying NOT NULL CHECK (source_type::text = ANY (ARRAY['summary'::character varying, 'experience'::character varying, 'github'::character varying, 'linkedin'::character varying]::text[])),
  text_content text NOT NULL,
  embedding USER-DEFINED NOT NULL,
  model_name character varying NOT NULL DEFAULT 'intfloat/multilingual-e5-base'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_embeddings_enrichment_profile FOREIGN KEY (enrichment_profile_id) REFERENCES public.enrichment_profiles(id)
);