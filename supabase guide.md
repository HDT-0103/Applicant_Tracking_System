# CẤU TRÚC CÁC BẢNG TRONG SUPABASE

create table public.abac_policies (
  id uuid not null default gen_random_uuid (),
  role character varying(50) not null,
  field_path character varying(255) not null,
  strategy character varying(50) not null default 'passthrough'::character varying,
  created_at timestamp with time zone not null default now(),
  constraint pk_abac_policy primary key (id),
  constraint uq_abac_role_field unique (role, field_path)
) TABLESPACE pg_default;
---
create table public.audit_log (
  id uuid not null default gen_random_uuid (),
  entity_type character varying(100) not null,
  entity_id character varying(255) not null,
  action public.audit_action not null,
  actor_id character varying(255) null,
  actor_role character varying(50) null,
  old_value jsonb null,
  new_value jsonb null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint pk_audit_log primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_audit_log_entity on public.audit_log using btree (entity_type, entity_id) TABLESPACE pg_default;

create index IF not exists idx_audit_log_actor on public.audit_log using btree (actor_id) TABLESPACE pg_default;

create index IF not exists idx_audit_log_action on public.audit_log using btree (action) TABLESPACE pg_default;

create index IF not exists idx_audit_log_created on public.audit_log using btree (created_at) TABLESPACE pg_default;


---
create table public.candidates (
  uuid character varying(36) not null,
  full_name character varying(255) null,
  github_username character varying(255) null,
  linkedin_url text null,
  resume_text text null,
  status character varying(50) not null default 'CREATED'::character varying,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  cv_file_path text null,
  email character varying(255) null,
  current_location character varying(255) null,
  current_company character varying(255) null,
  pronouns character varying(50) null,
  custom_pronouns character varying(100) null,
  github_url text null,
  portfolio_url text null,
  website_url text null,
  university character varying(255) null,
  faculty_program text null,
  graduation_year character varying(20) null,
  age_group character varying(50) null,
  gender_identity character varying(100) null,
  race text[] not null default '{}'::text[],
  military_status character varying(50) null,
  disability_status character varying(50) null,
  phone character varying(20) null,
  address text null,
  salary_expectation numeric(12, 2) null,
  constraint pk_candidate primary key (uuid)
) TABLESPACE pg_default;

create index IF not exists idx_candidates_status on public.candidates using btree (status) TABLESPACE pg_default;

create index IF not exists idx_candidates_full_name on public.candidates using btree (full_name) TABLESPACE pg_default;

create index IF not exists idx_candidates_email on public.candidates using btree (email) TABLESPACE pg_default;

create trigger trg_candidates_updated_at BEFORE
update on candidates for EACH row
execute FUNCTION update_updated_at_column ();

---
create table public.applications (
  id uuid not null default gen_random_uuid (),
  candidate_uuid character varying(36) not null,
  job_posting_id uuid not null,
  resume_id uuid not null,
  status character varying(50) not null default 'SUBMITTED'::character varying,
  cover_letter text null,
  work_authorization boolean null,
  office_attendance boolean null,
  referral_source character varying(255) null,
  preferred_talent_network boolean null,
  additional_information text null,
  submitted_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_applications primary key (id),
  constraint fk_application_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE,
  constraint fk_application_job_posting foreign KEY (job_posting_id) references jobs_posting (id) on delete CASCADE,
  constraint fk_application_resume foreign KEY (resume_id) references resumes (id) on delete CASCADE,
  constraint ck_application_status check (
    (
      (status)::text = any (
        array[
          ('SUBMITTED'::character varying)::text,
          ('SCREENING'::character varying)::text,
          ('INTERVIEW'::character varying)::text,
          ('OFFER'::character varying)::text,
          ('HIRED'::character varying)::text,
          ('REJECTED'::character varying)::text,
          ('WITHDRAWN'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_applications_candidate on public.applications using btree (candidate_uuid) TABLESPACE pg_default;

create index IF not exists idx_applications_job on public.applications using btree (job_posting_id) TABLESPACE pg_default;

create index IF not exists idx_applications_resume on public.applications using btree (resume_id) TABLESPACE pg_default;

create index IF not exists idx_applications_status on public.applications using btree (status) TABLESPACE pg_default;

create index IF not exists idx_applications_created_at on public.applications using btree (created_at) TABLESPACE pg_default;

create trigger trg_applications_updated_at BEFORE
update on applications for EACH row
execute FUNCTION update_updated_at_column ();
---

create table public.confirmed_slots (
  id character varying(36) not null,
  candidate_uuid character varying(36) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  interviewer_ids text[] not null default '{}'::text[],
  calendar_event_id text null,
  email_notified boolean not null default false,
  slack_notified boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint pk_confirmed_slot primary key (id),
  constraint fk_confirmed_slot_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_confirmed_slots_candidate on public.confirmed_slots using btree (candidate_uuid) TABLESPACE pg_default;

create index IF not exists idx_confirmed_slots_start on public.confirmed_slots using btree (start_time) TABLESPACE pg_default;

---
create table public.cv_reviews (
  id uuid not null default gen_random_uuid (),
  candidate_uuid character varying(36) not null,
  reviewer_id uuid not null,
  reviewer_role public.role_type not null,
  decision public.review_decision not null default 'pending'::review_decision,
  review_text text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_cv_review primary key (id),
  constraint uq_candidate_reviewer unique (candidate_uuid, reviewer_id),
  constraint fk_cv_review_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE,
  constraint fk_cv_review_reviewer foreign KEY (reviewer_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_cv_reviews_candidate on public.cv_reviews using btree (candidate_uuid) TABLESPACE pg_default;

create index IF not exists idx_cv_reviews_reviewer on public.cv_reviews using btree (reviewer_id) TABLESPACE pg_default;

---
create table public.enrichment_profiles (
  id uuid not null default gen_random_uuid (),
  candidate_uuid character varying(36) not null,
  enrichment_status public.enrichment_status not null default 'QUEUED'::enrichment_status,
  match_confidence_score double precision null,
  score_increase double precision null,
  skill_matrix jsonb null,
  semantic_tags text[] not null default '{}'::text[],
  updated_at timestamp with time zone null,
  constraint pk_enrichment_profile primary key (id),
  constraint uq_enrichment_profile_candidate unique (candidate_uuid),
  constraint fk_enrichment_profile_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_enrichment_status on public.enrichment_profiles using btree (enrichment_status) TABLESPACE pg_default;

---
create table public.github_profiles (
  id uuid not null default gen_random_uuid (),
  candidate_uuid character varying(36) not null,
  public_repos_count integer not null default 0,
  top_languages jsonb not null default '{}'::jsonb,
  readme_content text null,
  repos jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_github_profile primary key (id),
  constraint uq_github_profile_candidate unique (candidate_uuid),
  constraint fk_github_profile_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE
) TABLESPACE pg_default;

---
create table public.interviewers (
  id character varying(50) not null,
  name character varying(255) not null,
  email character varying(255) not null default ''::character varying,
  job_title character varying(100) not null,
  initials character varying(10) not null,
  color character varying(10) not null,
  cal_connected boolean not null default false,
  calendar_api_key text null,
  calendar_id character varying(255) not null default 'primary'::character varying,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_interviewer primary key (id)
) TABLESPACE pg_default;

---
create table public.linkedin_profiles (
  id uuid not null default gen_random_uuid (),
  candidate_uuid character varying(36) not null,
  full_name character varying(255) null,
  headline text null,
  profile_url text null,
  avatar_url text null,
  experiences jsonb not null default '[]'::jsonb,
  educations jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_linkedin_profile primary key (id),
  constraint uq_linkedin_profile_candidate unique (candidate_uuid),
  constraint fk_linkedin_profile_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE
) TABLESPACE pg_default;

---
create table public.resumes (
  id uuid not null default gen_random_uuid (),
  candidate_uuid character varying(36) not null,
  filename character varying(255) null,
  file_path text null,
  text_content text null,
  created_at timestamp with time zone not null default now(),
  constraint pk_resume primary key (id),
  constraint fk_resume_candidate foreign KEY (candidate_uuid) references candidates (uuid) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_resumes_candidate on public.resumes using btree (candidate_uuid) TABLESPACE pg_default;
---
create table public.users (
  id uuid not null default gen_random_uuid (),
  email character varying(255) not null,
  name character varying(255) not null,
  role public.role_type not null,
  picture text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_user primary key (id),
  constraint uq_user_email unique (email)
) TABLESPACE pg_default;

create index IF not exists idx_users_role on public.users using btree (role) TABLESPACE pg_default;
---

create table public.jobs_posting (
  id uuid not null default gen_random_uuid (),
  job_title character varying(255) not null,
  department character varying(100) null,
  location character varying(255) null,
  seniority_level character varying(100) null,
  employment_type character varying(100) null,
  work_mode character varying(100) null,
  target_openings integer null,
  salary_min numeric(12, 2) null,
  salary_max numeric(12, 2) null,
  must_have_skills text[] not null default '{}'::text[],
  nice_to_have_skills text[] not null default '{}'::text[],
  description text null,
  key_responsibilities text null,
  requirements text null,
  nice_to_have_qualifications text null,
  status character varying(50) not null default 'DRAFT'::character varying,
  posted_at timestamp with time zone null,
  expires_at timestamp with time zone null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_saved_at timestamp with time zone not null default now(),
  constraint pk_jobs_posting primary key (id),
  constraint fk_jobs_posting_created_by foreign KEY (created_by) references users (id) on delete set null,
  constraint ck_jobs_posting_status check (
    (
      (status)::text = any (
        (
          array[
            'DRAFT'::character varying,
            'PUBLISHED'::character varying,
            'CLOSED'::character varying,
            'ARCHIVED'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_title on public.jobs_posting using btree (job_title) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_department on public.jobs_posting using btree (department) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_location on public.jobs_posting using btree (location) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_status on public.jobs_posting using btree (status) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_created_by on public.jobs_posting using btree (created_by) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_posted_at on public.jobs_posting using btree (posted_at) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_expires_at on public.jobs_posting using btree (expires_at) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_skills on public.jobs_posting using gin (must_have_skills) TABLESPACE pg_default;

create index IF not exists idx_jobs_posting_preferred_skills on public.jobs_posting using gin (nice_to_have_skills) TABLESPACE pg_default;

create trigger trg_jobs_posting_updated_at BEFORE
update on jobs_posting for EACH row
execute FUNCTION update_updated_at_column ();

---

create table public.universities (
  id bigserial not null,
  name text not null,
  country text not null,
  alpha_two_code character varying(10) null,
  state_province text null,
  domains text[] null,
  web_pages text[] null,
  constraint universities_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_universities_name_lower on public.universities using btree (lower(name)) TABLESPACE pg_default;

---