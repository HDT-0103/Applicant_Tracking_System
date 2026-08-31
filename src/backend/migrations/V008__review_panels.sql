-- =========================================================================
--  V008: Hội đồng Tech Lead theo từng tin tuyển dụng
--  Prerequisite: V001, V003 (cv_reviews), V004 (applications)
-- =========================================================================
--
--  Trước V008, ngưỡng duyệt 80% được tính trên TOÀN BỘ tech lead trong bảng
--  `users`. Thêm một tech lead vào hệ thống là kéo tụt tỉ lệ duyệt của mọi
--  ứng viên đang chờ, kể cả ở những vị trí người đó không liên quan.
--
--  Từ đây, HR mời đích danh tech lead vào từng tin tuyển dụng; chỉ người được
--  mời mới xem và chấm được hồ sơ ứng tuyển vào tin đó.
-- =========================================================================

CREATE TABLE IF NOT EXISTS job_posting_reviewers (
    job_posting_id  uuid        NOT NULL,
    reviewer_id     uuid        NOT NULL,
    invited_by      uuid        NOT NULL,
    invited_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_job_posting_reviewer
        PRIMARY KEY (job_posting_id, reviewer_id),

    CONSTRAINT fk_jpr_job
        FOREIGN KEY (job_posting_id) REFERENCES jobs_posting(id) ON DELETE CASCADE,

    -- RESTRICT chứ không CASCADE: xoá một tài khoản KHÔNG được phép âm thầm
    -- làm teo hội đồng của những hồ sơ đang chấm dở. Muốn xoá người thì phải
    -- gỡ họ khỏi các hội đồng trước — một thao tác có chủ đích, nhìn thấy được.
    CONSTRAINT fk_jpr_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,

    CONSTRAINT fk_jpr_invited_by
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Tra cứu chính là "hội đồng của tin này gồm ai" (đếm sĩ số) và "người này có
-- trong hội đồng nào không" (gác quyền xem hồ sơ). Khoá chính phục vụ chiều
-- thứ nhất; index dưới đây phục vụ chiều thứ hai.
CREATE INDEX IF NOT EXISTS idx_jpr_reviewer
    ON job_posting_reviewers(reviewer_id);


-- Sĩ số hội đồng được CHỐT tại lá phiếu đầu tiên ------------------------------
--
-- Nếu tính sĩ số theo thời gian thực, mọi thay đổi nhân sự đều hồi tố lên các
-- hồ sơ đang chấm dở: HR mời thêm một người là ứng viên sắp đủ 4/5 phiếu bỗng
-- quay về "đang chờ". Cột dưới đây ghi lại sĩ số ngay khi có phiếu đầu tiên,
-- và mọi phép tính sau đó dùng con số đã chốt.
--
-- NULL = chưa ai chấm, cứ đếm hội đồng hiện tại.
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS review_panel_size integer;

COMMENT ON COLUMN applications.review_panel_size IS
    'Sĩ số hội đồng Tech Lead, chốt tại lá phiếu đầu tiên. NULL = chưa ai chấm.';
