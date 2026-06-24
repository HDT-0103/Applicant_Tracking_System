create extension if not exists vector;
create extension if not exists pgcrypto;

create type status_type as enum('done', 'waiting', 'canceled');
create type role_type as enum('candidate', 'recruiter', 'admin');

-- business
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
    id serial,
    user_id uuid not null, -- đổi sang uuid để khớp với users.id
    position varchar(255),
    description text,
    summary text,
    skills text[], 
    created_at timestamptz default now(),

    constraint pk_requirement primary key (id)
);

create table meetings (
    id serial,
    scheduled_at timestamptz,
    status status_type default 'waiting',
    meeting_link varchar(512),
    host_id uuid not null, -- đổi sang uuid để khớp với users.id
    participant_id uuid not null, -- đổi sang uuid để khớp với users.id
    created_at timestamptz default now(),
    
    constraint pk_meeting primary key (id)
);

-- ai
create table resume_embeddings (
    id serial,
    resume_id uuid not null, -- đổi sang uuid để khớp với resumes.id
    embedding vector(1024),
    model_name varchar(100) not null,
    created_at timestamptz default now(),

    constraint pk_embedding_resume primary key (id)
);

create table requirement_embeddings (
    id serial,
    requirement_id int not null, -- giữ int vì requirements.id là serial
    embedding vector(1024),
    model_name varchar(100) not null,
    created_at timestamptz default now(),

    constraint pk_embedding_requirement primary key (id)
);

-- analysis
create table analyses (
    id serial,
    resume_id uuid not null, -- đổi sang uuid để khớp với resumes.id
    model_name varchar(100),
    summary text,
    strength text,
    weakness text,
    skills text[],
    created_at timestamptz default now(),

    constraint pk_analysis primary key (id)
);

-- tạo các ràng buộc khóa ngoại 
alter table resumes
add constraint fk_resumes_user foreign key (user_id) references users(id) on delete cascade;

alter table requirements
add constraint fk_requirements_user foreign key (user_id) references users(id) on delete cascade;

alter table meetings
add constraint fk_meetings_host foreign key (host_id) references users(id) on delete cascade;

alter table meetings
add constraint fk_meetings_participant foreign key (participant_id) references users(id) on delete cascade;

alter table resume_embeddings
add constraint fk_resume_embeddings_resume foreign key (resume_id) references resumes(id) on delete cascade;

alter table requirement_embeddings
add constraint fk_requirement_embeddings_requirement foreign key (requirement_id) references requirements(id) on delete cascade;

alter table analyses
add constraint fk_analyses_resume foreign key (resume_id) references resumes(id) on delete cascade;

-- thêm index cho các khóa ngoại để tối ưu tốc độ tìm kiếm
create index idx_resumes_user_id on resumes(user_id);
create index idx_requirements_user_id on requirements(user_id);
create index idx_meetings_host_id on meetings(host_id);
create index idx_meetings_participant_id on meetings(participant_id);
create index idx_resume_embeddings_resume_id on resume_embeddings(resume_id);
create index idx_requirement_embeddings_requirement_id on requirement_embeddings(requirement_id);
create index idx_analyses_resume_id on analyses(resume_id);