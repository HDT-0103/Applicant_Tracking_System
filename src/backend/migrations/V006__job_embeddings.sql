-- V006: Embedding cho job posting, phục vụ AI agent scoring/ranking.
--
-- Convention với phía candidate (người làm scoring):
--   * Model: intfloat/multilingual-e5-base, 768 chiều.
--   * JD embed với prefix "query:", resume/candidate embed với prefix "passage:".
--     Phải dùng CÙNG model và đúng cặp prefix thì cosine mới có nghĩa.
--   * Skills KHÔNG embed — giữ dạng text[] sẵn có trên jobs_posting
--     (must_have_skills / nice_to_have_skills) để hard-filter chính xác
--     (vd: must_have_skills @> ARRAY['python']), không so cosine trên skill.
--
-- Apply thủ công trên Supabase SQL editor (giống V004/V005).
-- Verify sau khi apply: ./venv/bin/python src/backend/scripts/check_job_embeddings_schema.py

CREATE TABLE public.job_embeddings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id  uuid NOT NULL REFERENCES public.jobs_posting(id) ON DELETE CASCADE,
    source_type     varchar NOT NULL CHECK (source_type IN ('summary', 'requirements')),
    text_content    text NOT NULL,
    embedding       vector(768) NOT NULL,
    model_name      varchar NOT NULL DEFAULT 'intfloat/multilingual-e5-base',
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_job_embeddings_job_source_model UNIQUE (job_posting_id, source_type, model_name)
);

CREATE INDEX idx_job_embeddings_vec
    ON public.job_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_job_embeddings_job
    ON public.job_embeddings (job_posting_id);
