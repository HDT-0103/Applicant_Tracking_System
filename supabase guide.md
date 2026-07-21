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
create table public.candidate_details (
  id uuid not null default gen_random_uuid (),
  resume_id uuid not null,
  phone character varying(20) null,
  address text null,
  salary_expectation numeric(12, 2) null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint pk_candidate_detail primary key (id),
  constraint fk_candidate_details_resume foreign KEY (resume_id) references resumes (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_candidate_details_resume_id on public.candidate_details using btree (resume_id) TABLESPACE pg_default;


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
  constraint pk_candidate primary key (uuid)
) TABLESPACE pg_default;

create index IF not exists idx_candidates_status on public.candidates using btree (status) TABLESPACE pg_default;

create index IF not exists idx_candidates_full_name on public.candidates using btree (full_name) TABLESPACE pg_default;

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