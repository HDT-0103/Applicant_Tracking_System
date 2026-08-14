-- =========================================================================
--  V003: CV Review / Approval Workflow
--  Prerequisite: V001, V002
-- =========================================================================

CREATE TABLE IF NOT EXISTS cv_reviews (
    id              uuid DEFAULT gen_random_uuid(),
    candidate_uuid  varchar(255) NOT NULL,
    reviewer_id     uuid NOT NULL,
    reviewer_role   role_type NOT NULL,
    decision        varchar(20) NOT NULL DEFAULT 'pending',
    review_text     text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),

    CONSTRAINT pk_cv_review PRIMARY KEY (id),
    CONSTRAINT uq_candidate_reviewer UNIQUE (candidate_uuid, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_cv_reviews_candidate
    ON cv_reviews(candidate_uuid);
