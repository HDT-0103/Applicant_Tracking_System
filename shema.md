| ddl_schema                                                                                             |
| ------------------------------------------------------------------------------------------------------ |
| CREATE TABLE abac_policies (                                                                           |
| role character varying(50) NOT NULL,                                                                   |
| updated_at timestamp with time zone DEFAULT now(),                                                     |
| is_masked boolean DEFAULT true,                                                                        |
| field_path character varying(255) NOT NULL,                                                            |
| strategy character varying(50) NOT NULL DEFAULT 'passthrough'::character varying,                      |
| resource character varying(100),                                                                       |
| field_name character varying(100),                                                                     |
| masking_pattern character varying(50) DEFAULT '\*\*\*'::character varying,                             |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| id uuid NOT NULL DEFAULT gen_random_uuid()                                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE api_rate_limits (                                                                         |
| updated_at timestamp with time zone DEFAULT now(),                                                     |
| rate_limit_reset timestamp with time zone,                                                             |
| rate_limit_remaining integer,                                                                          |
| rate_limit_total integer,                                                                              |
| provider character varying(50) NOT NULL                                                                |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE applications (                                                                            |
| submitted_at timestamp with time zone NOT NULL DEFAULT now(),                                          |
| job_posting_id uuid NOT NULL,                                                                          |
| resume_id uuid NOT NULL,                                                                               |
| work_authorization boolean,                                                                            |
| office_attendance boolean,                                                                             |
| preferred_talent_network boolean,                                                                      |
| portfolio_url text,                                                                                    |
| additional_information text,                                                                           |
| github_project text,                                                                                   |
| referral_source character varying(255),                                                                |
| experience_bucket character varying(20),                                                               |
| work_style character varying(30),                                                                      |
| cover_letter text,                                                                                     |
| status character varying(50) NOT NULL DEFAULT 'SUBMITTED'::character varying,                          |
| availability_bucket character varying(30),                                                             |
| work_mode_pref ARRAY NOT NULL DEFAULT '{}'::text[],                                                    |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| salary_basis character varying(10),                                                                    |
| salary_currency character varying(10) NOT NULL DEFAULT 'VND'::character varying,                       |
| conflict_story text,                                                                                   |
| motivation_other text,                                                                                 |
| motivation_reason character varying(50),                                                               |
| proudest_project text,                                                                                 |
| github_embedding USER-DEFINED,                                                                         |
| overall_score double precision,                                                                        |
| github_score double precision,                                                                         |
| experience_score double precision,                                                                     |
| summary_score double precision,                                                                        |
| consent_at timestamp with time zone,                                                                   |
| consent_data_sharing boolean NOT NULL DEFAULT false,                                                   |
| skill_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,                                                      |
| availability_date date,                                                                                |
| expected_salary_max numeric,                                                                           |
| expected_salary_min numeric,                                                                           |
| updated_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| id uuid NOT NULL DEFAULT gen_random_uuid()                                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE audit_logs (                                                                              |
| created_at timestamp with time zone DEFAULT now(),                                                     |
| user_id uuid,                                                                                          |
| details jsonb,                                                                                         |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| candidate_uuid uuid,                                                                                   |
| user_agent character varying(512),                                                                     |
| ip_address character varying(45),                                                                      |
| action character varying(100)                                                                          |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE candidates (                                                                              |
| github_username character varying(255),                                                                |
| linkedin_url text,                                                                                     |
| resume_text text,                                                                                      |
| status character varying(50) NOT NULL DEFAULT 'CREATED'::character varying,                            |
| cv_file_path text,                                                                                     |
| faculty_program text,                                                                                  |
| current_company character varying(255),                                                                |
| pronouns character varying(50),                                                                        |
| custom_pronouns character varying(100),                                                                |
| university character varying(255),                                                                     |
| email character varying(255),                                                                          |
| github_url text,                                                                                       |
| portfolio_url text,                                                                                    |
| website_url text,                                                                                      |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| updated_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| salary_expectation numeric,                                                                            |
| education_level character varying(50),                                                                 |
| current_location character varying(255),                                                               |
| address text,                                                                                          |
| phone character varying(20),                                                                           |
| disability_status character varying(50),                                                               |
| military_status character varying(50),                                                                 |
| race ARRAY NOT NULL DEFAULT '{}'::text[],                                                              |
| gender_identity character varying(100),                                                                |
| age_group character varying(50),                                                                       |
| graduation_year character varying(20),                                                                 |
| uuid character varying(36) NOT NULL,                                                                   |
| full_name character varying(255)                                                                       |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE confirmed_slots (                                                                         |
| calendar_event_id text,                                                                                |
| start_time timestamp with time zone NOT NULL,                                                          |
| end_time timestamp with time zone NOT NULL,                                                            |
| email_notified boolean NOT NULL DEFAULT false,                                                         |
| slack_notified boolean NOT NULL DEFAULT false,                                                         |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| id character varying(36) NOT NULL,                                                                     |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| interviewer_ids ARRAY NOT NULL DEFAULT '{}'::text[]                                                    |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE cv_reviews (                                                                              |
| review_text text,                                                                                      |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| reviewer_id uuid NOT NULL,                                                                             |
| reviewer_role USER-DEFINED NOT NULL,                                                                   |
| decision USER-DEFINED NOT NULL DEFAULT 'pending'::review_decision,                                     |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| updated_at timestamp with time zone NOT NULL DEFAULT now()                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE embeddings (                                                                              |
| created_at timestamp with time zone DEFAULT now(),                                                     |
| text_content text NOT NULL,                                                                            |
| embedding USER-DEFINED NOT NULL,                                                                       |
| enrichment_profile_id uuid NOT NULL,                                                                   |
| model_name character varying(100) NOT NULL DEFAULT 'intfloat/multilingual-e5-base'::character varying, |
| source_type character varying(50) NOT NULL,                                                            |
| id uuid NOT NULL DEFAULT gen_random_uuid()                                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE enrichment_profiles (                                                                     |
| skill_matrix jsonb,                                                                                    |
| experience text,                                                                                       |
| summary text,                                                                                          |
| skills ARRAY NOT NULL DEFAULT '{}'::text[],                                                            |
| semantic_tags ARRAY NOT NULL DEFAULT '{}'::text[],                                                     |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| enrichment_status USER-DEFINED NOT NULL DEFAULT 'QUEUED'::enrichment_status,                           |
| match_confidence_score double precision,                                                               |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| score_increase double precision,                                                                       |
| updated_at timestamp with time zone,                                                                   |
| created_at timestamp with time zone DEFAULT now()                                                      |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE github_profiles (                                                                         |
| top_languages jsonb NOT NULL DEFAULT '{}'::jsonb,                                                      |
| public_repos_count integer NOT NULL DEFAULT 0,                                                         |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| repos jsonb NOT NULL DEFAULT '[]'::jsonb,                                                              |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| readme_content text,                                                                                   |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| updated_at timestamp with time zone NOT NULL DEFAULT now()                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE interviewers (                                                                            |
| cal_connected boolean NOT NULL DEFAULT false,                                                          |
| updated_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| name character varying(255) NOT NULL,                                                                  |
| id character varying(50) NOT NULL,                                                                     |
| email character varying(255) NOT NULL DEFAULT ''::character varying,                                   |
| job_title character varying(100) NOT NULL,                                                             |
| initials character varying(10) NOT NULL,                                                               |
| color character varying(10) NOT NULL,                                                                  |
| calendar_api_key text,                                                                                 |
| calendar_id character varying(255) NOT NULL DEFAULT 'primary'::character varying,                      |
| calendar_refresh_token text                                                                            |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE job_embeddings (                                                                          |
| job_posting_id uuid NOT NULL,                                                                          |
| source_type character varying NOT NULL,                                                                |
| text_content text NOT NULL,                                                                            |
| model_name character varying NOT NULL DEFAULT 'intfloat/multilingual-e5-base'::character varying,      |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| embedding USER-DEFINED NOT NULL,                                                                       |
| id uuid NOT NULL DEFAULT gen_random_uuid()                                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE jobs_posting (                                                                            |
| location character varying(255),                                                                       |
| job_title character varying(255) NOT NULL,                                                             |
| status character varying(50) NOT NULL DEFAULT 'DRAFT'::character varying,                              |
| nice_to_have_qualifications text,                                                                      |
| requirements text,                                                                                     |
| key_responsibilities text,                                                                             |
| description text,                                                                                      |
| nice_to_have_skills ARRAY NOT NULL DEFAULT '{}'::text[],                                               |
| must_have_skills ARRAY NOT NULL DEFAULT '{}'::text[],                                                  |
| work_mode character varying(100),                                                                      |
| employment_type character varying(100),                                                                |
| seniority_level character varying(100),                                                                |
| department character varying(100),                                                                     |
| expires_at timestamp with time zone,                                                                   |
| posted_at timestamp with time zone,                                                                    |
| last_saved_at timestamp with time zone NOT NULL DEFAULT now(),                                         |
| created_by uuid,                                                                                       |
| salary_max numeric,                                                                                    |
| salary_min numeric,                                                                                    |
| target_openings integer,                                                                               |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| updated_at timestamp with time zone NOT NULL DEFAULT now()                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE linkedin_profiles (                                                                       |
| experiences jsonb NOT NULL DEFAULT '[]'::jsonb,                                                        |
| profile_url text,                                                                                      |
| avatar_url text,                                                                                       |
| updated_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| educations jsonb NOT NULL DEFAULT '[]'::jsonb,                                                         |
| certifications jsonb NOT NULL DEFAULT '[]'::jsonb,                                                     |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| full_name character varying(255),                                                                      |
| headline text                                                                                          |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE llm_usage_logs (                                                                          |
| model_name character varying(100),                                                                     |
| created_at timestamp with time zone DEFAULT now(),                                                     |
| operation_type character varying(100),                                                                 |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| user_id uuid,                                                                                          |
| prompt_tokens integer DEFAULT 0,                                                                       |
| completion_tokens integer DEFAULT 0,                                                                   |
| total_tokens integer DEFAULT 0,                                                                        |
| estimated_cost numeric DEFAULT 0.000000                                                                |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE resumes (                                                                                 |
| filename character varying(255),                                                                       |
| candidate_uuid character varying(36) NOT NULL,                                                         |
| file_path text,                                                                                        |
| text_content text,                                                                                     |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| created_at timestamp with time zone NOT NULL DEFAULT now()                                             |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE universities (                                                                            |
| id bigint NOT NULL DEFAULT nextval('universities_id_seq'::regclass),                                   |
| web_pages ARRAY,                                                                                       |
| name text NOT NULL,                                                                                    |
| country text NOT NULL,                                                                                 |
| alpha_two_code character varying(10),                                                                  |
| state_province text,                                                                                   |
| domains ARRAY                                                                                          |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE user_sessions (                                                                           |
| ip_address character varying(45),                                                                      |
| user_id uuid,                                                                                          |
| expires_at timestamp with time zone,                                                                   |
| is_revoked boolean DEFAULT false,                                                                      |
| created_at timestamp with time zone DEFAULT now(),                                                     |
| updated_at timestamp with time zone DEFAULT now(),                                                     |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| user_agent character varying(512),                                                                     |
| token_jti character varying(255)                                                                       |
| );                                                                                                     |
|                                                                                                        |
| CREATE TABLE users (                                                                                   |
| is_approved boolean NOT NULL DEFAULT false,                                                            |
| picture text,                                                                                          |
| password_hash character varying(255),                                                                  |
| email character varying(255) NOT NULL,                                                                 |
| id uuid NOT NULL DEFAULT gen_random_uuid(),                                                            |
| role USER-DEFINED NOT NULL,                                                                            |
| is_active boolean NOT NULL DEFAULT true,                                                               |
| created_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| updated_at timestamp with time zone NOT NULL DEFAULT now(),                                            |
| name character varying(255) NOT NULL                                                                   |
| );                                                                                                     |
|                                                                                                        |
