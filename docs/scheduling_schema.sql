-- Future Supabase migration for the scheduling module
-- Run this when moving from InMemory → Supabase

CREATE TABLE IF NOT EXISTS interviewers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT '',
    initials    TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#6366F1',
    cal_connected       BOOLEAN NOT NULL DEFAULT FALSE,
    calendar_api_key    TEXT,
    calendar_id         TEXT NOT NULL DEFAULT 'primary',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS confirmed_slots (
    id              TEXT PRIMARY KEY,
    candidate_id    TEXT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    interviewer_ids TEXT[] NOT NULL DEFAULT '{}',
    calendar_event_id   TEXT,
    slack_notified      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confirmed_slots_candidate ON confirmed_slots(candidate_id);

-- Seed interviewers
INSERT INTO interviewers (id, name, role, initials, color, cal_connected, calendar_api_key) VALUES
    ('interviewer-sarah-chen', 'Sarah Chen',   'Staff Engineer',         'SC', '#6366F1', TRUE,  NULL),
    ('interviewer-mike-park',  'Mike Park',    'Tech Lead',              'MP', '#10B981', TRUE,  NULL),
    ('interviewer-lisa-wong',  'Lisa Wong',    'Engineering Manager',    'LW', '#F59E0B', FALSE, NULL),
    ('interviewer-david-kim',  'David Kim',    'Senior Engineer',        'DK', '#EC4899', FALSE, NULL)
ON CONFLICT (id) DO NOTHING;
