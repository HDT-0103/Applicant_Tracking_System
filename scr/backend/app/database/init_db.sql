create extension if not exists vector;
create extension if not exists pgcrypto;

create type status_type as enum('done', 'waiting', 'canceled');
create type role_type as enum('candidate', 'recruiter', 'admin');

-- =========================================================================
-- BUSINESS TABLES
-- =========================================================================

create table users (
    id uuid default gen_random_uuid(),
    name varchar(255) not null,
    email varchar(255) unique not null,
    role role_type not null,
    created_at timestamptz default now(),

    constraint pk_user primary key (id)
);

create table resumes (
    id uuid default gen_random_uuid(),
    user_id uuid not null,
    raw_text text,
    file_path varchar(512),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint pk_resume primary key (id)
);

create table requirements (
    id uuid default gen_random_uuid(), -- Chuyển sang UUID để đồng bộ
    user_id uuid not null,
    position varchar(255),
    description text,
    summary text,
    skills text[], 
    created_at timestamptz default now(),

    constraint pk_requirement primary key (id)
);

create table meetings (
    id uuid default gen_random_uuid(), -- Chuyển sang UUID để đồng bộ
    scheduled_at timestamptz,
    status status_type default 'waiting',
    meeting_link varchar(512),
    host_id uuid not null,
    participant_id uuid not null,
    created_at timestamptz default now(),
    
    constraint pk_meeting primary key (id)
);

-- =========================================================================
-- AI EMBEDDING TABLES (Thêm các mục embedding theo thiết kế gốc)
-- =========================================================================

create table resume_embeddings (
    id uuid default gen_random_uuid(),
    resume_id uuid not null,
    model_name varchar(100) not null,
    summary_embedding vector(768),      -- Thêm lại theo bản gốc
    skills_embedding vector(768),       -- Thêm lại theo bản gốc
    experience_embedding vector(768),   -- Thêm lại theo bản gốc
    created_at timestamptz default now(),

    constraint pk_embedding_resume primary key (id)
);

create table requirement_embeddings (
    id uuid default gen_random_uuid(),
    requirement_id uuid not null,         -- Chuyển sang UUID để khớp với bảng requirements mới
    model_name varchar(100) not null,
    summary_embedding vector(768),      -- Thêm lại theo bản gốc
    skills_embedding vector(768),       -- Thêm lại theo bản gốc
    experience_embedding vector(768),   -- Thêm lại theo bản gốc
    created_at timestamptz default now(),

    constraint pk_embedding_requirement primary key (id)
);

-- =========================================================================
-- ANALYSIS TABLES (Tách biệt Resume và Requirement Analysis)
-- =========================================================================

create table resume_analyses (
    id uuid default gen_random_uuid(),
    resume_id uuid not null,
    model_name varchar(100),
    summary text,
    skills text[],
    strengths text[],                    -- Đổi sang số nhiều mảng text giống bản thiết kế gốc
    weaknesses text[],                   -- Đổi sang số nhiều mảng text giống bản thiết kế gốc
    experience jsonb,                    -- Lưu dạng jsonb để linh hoạt cấu trúc timeline
    created_at timestamptz default now(),

    constraint pk_resume_analysis primary key (id)
);

-- Tạo thêm bảng Requirement Analysis theo yêu cầu của bạn
create table requirement_analyses (
    id uuid default gen_random_uuid(),
    requirement_id uuid not null,
    model_name varchar(100),
    summary text,
    skills text[],
    experience text,
    created_at timestamptz default now(),

    constraint pk_requirement_analysis primary key (id)
);

-- =========================================================================
-- FOREIGN KEY CONSTRAINTS
-- =========================================================================

alter table resumes
add constraint fk_resumes_user foreign key (user_id) references users(id) on delete cascade;

alter table requirements
add constraint fk_requirements_user foreign key (user_id) references users(id) on delete cascade;

alter table meetings
add constraint fk_meetings_host foreign key (host_id) references users(id) on delete cascade,
add constraint fk_meetings_participant foreign key (participant_id) references users(id) on delete cascade;

alter table resume_embeddings
add constraint fk_resume_embeddings_resume foreign key (resume_id) references resumes(id) on delete cascade;

alter table requirement_embeddings
add constraint fk_requirement_embeddings_requirement foreign key (requirement_id) references requirements(id) on delete cascade;

alter table resume_analyses
add constraint fk_resume_analyses_resume foreign key (resume_id) references resumes(id) on delete cascade;

alter table requirement_analyses
add constraint fk_requirement_analyses_requirement foreign key (requirement_id) references requirements(id) on delete cascade;

-- =========================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =========================================================================

create index idx_resumes_user_id on resumes(user_id);
create index idx_requirements_user_id on requirements(user_id);
create index idx_meetings_host_id on meetings(host_id);
create index idx_meetings_participant_id on meetings(participant_id);
create index idx_resume_embeddings_resume_id on resume_embeddings(resume_id);
create index idx_requirement_embeddings_requirement_id on requirement_embeddings(requirement_id);
create index idx_resume_analyses_resume_id on resume_analyses(resume_id);
create index idx_requirement_analyses_req_id on requirement_analyses(requirement_id);