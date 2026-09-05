-- =========================================================================
--  V009: Thông tin công ty của người dùng nội bộ (HR / Tech Lead)
--  Prerequisite: V001 (users), V005 (role đã hợp nhất)
-- =========================================================================
--
--  Người dùng khai công ty khi đăng ký, hoặc ở lần đăng nhập Google đầu tiên
--  (màn hình /onboarding/company). Công ty là văn bản tự do THEO TỪNG USER —
--  không có bảng organizations, không có khái niệm "cùng công ty thì thấy
--  chung tin". Phạm vi dữ liệu vẫn tính theo người TẠO tin (jobs_posting.
--  created_by, xem job_visibility.py); cột này chỉ để hiển thị.
--
--  Cả hai cột đều NULL được: tài khoản có sẵn không có gì để điền, và
--  frontend dựa vào `company_name IS NULL` để biết ai còn phải hoàn tất hồ sơ.
--
--  KHÔNG đặt tên cột là `company`: đó là từ trong whitelist ABAC (công ty
--  trong lịch sử làm việc của ỨNG VIÊN), trùng tên là mời gọi nhầm lẫn.
--
--  Chạy TRƯỚC khi deploy code: backend ghi `company_name` ngay trong INSERT
--  lúc đăng ký, thiếu cột thì đăng ký trả 500.
-- =========================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_name    varchar(200),
    ADD COLUMN IF NOT EXISTS company_website varchar(500);

COMMENT ON COLUMN users.company_name IS
    'Công ty của người dùng nội bộ, khai lúc đăng ký / lần đăng nhập Google đầu. NULL = chưa hoàn tất hồ sơ.';
COMMENT ON COLUMN users.company_website IS
    'Website công ty, tuỳ chọn.';

-- Kiểm tra sau khi chạy:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name LIKE 'company_%';
