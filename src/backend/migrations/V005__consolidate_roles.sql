-- =========================================================================
--  V005: Hợp nhất phân quyền về đúng 3 role
--  Prerequisite: V001, V002 (V002 đã thêm 'hr' và 'tech_lead' vào role_type)
--
--  Trước migration này hệ thống có 3 bộ từ vựng lệch nhau cho cùng một con
--  người. Sau migration chỉ còn:
--
--      admin      — quản trị hệ thống, không tham gia nghiệp vụ
--      hr         — vận hành tuyển dụng, thấy đầy đủ dữ liệu ứng viên
--      tech_lead  — vận hành y hệt hr, PII ứng viên bị ABAC che
--
--  Quy đổi:  recruiter -> hr        (người phụ trách tuyển dụng)
--            hr_manager -> hr       (từ vựng của bảng Supabase)
--            interviewer -> tech_lead (người review kỹ thuật)
--
--  Migration idempotent: chạy lại nhiều lần không đổi kết quả.
--
--  LƯU Ý QUAN TRỌNG
--  1. Postgres KHÔNG hỗ trợ xoá giá trị khỏi enum, nên 'recruiter',
--     'interviewer', 'candidate' vẫn nằm trong type `role_type`. Chúng chỉ
--     ngừng được dùng ở tầng ứng dụng. Đây cũng là đường rollback.
--  2. Phải chạy TRƯỚC khi deploy code mới. Code mới có RoleType chỉ 3 giá trị,
--     đọc phải một hàng còn role cũ sẽ ném LookupError.
--  3. Access token đã phát hành vẫn mang role cũ. Sau khi chạy, hoặc chờ token
--     hết hạn, hoặc thu hồi phiên: UPDATE user_sessions SET is_revoked = TRUE;
--     (backend cũng tự quy đổi role cũ trong token, xem roles.normalise_role)
-- =========================================================================

-- Ảnh chụp trước khi đổi — so sánh với câu cuối file để kiểm tra.
-- SELECT role::text, count(*) FROM users GROUP BY role ORDER BY role;

BEGIN;

-- 1. users.role
UPDATE users SET role = 'hr'::role_type
 WHERE role::text IN ('recruiter', 'hr_manager');

UPDATE users SET role = 'tech_lead'::role_type
 WHERE role::text = 'interviewer';

-- 2. cv_reviews.reviewer_role (cùng dùng type role_type)
--    Bảng chỉ có nghĩa với hr/tech_lead; bản ghi của recruiter/interviewer là
--    cùng những con người đó dưới tên cũ.
UPDATE cv_reviews SET reviewer_role = 'hr'::role_type
 WHERE reviewer_role::text IN ('recruiter', 'hr_manager');

UPDATE cv_reviews SET reviewer_role = 'tech_lead'::role_type
 WHERE reviewer_role::text = 'interviewer';

COMMIT;

-- 3. Kiểm tra sau migration. Kết quả mong đợi: chỉ còn admin / hr / tech_lead.
--    Nếu còn dòng nào khác -> DỪNG, chưa deploy code mới.
--
-- SELECT role::text, count(*) FROM users GROUP BY role ORDER BY role;
--
-- Câu này phải trả về 0 dòng:
-- SELECT id, email, role::text FROM users
--  WHERE role::text NOT IN ('admin', 'hr', 'tech_lead');
