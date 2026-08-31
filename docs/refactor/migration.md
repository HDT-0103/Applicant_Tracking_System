# Documentation: Migration Guide (SQLAlchemy -> Supabase SDK)

## 1. Tổng quan Dự án (Overview)
Dự án đã hoàn tất quá trình chuyển đổi toàn bộ tầng truy xuất dữ liệu (Data Access Layer) từ **SQLAlchemy ORM (AsyncSession/Session)** sang **Supabase Python SDK (`Client`)**.

### Mục tiêu đạt được:
- **Loại bỏ ORM Overhead:** Không dùng SQLAlchemy Models, `select()`, `update()`, `AsyncSession`.
- **Đơn giản hóa Architecture:** Tương tác trực tiếp với Supabase qua PostgREST Client.
- **Bảo mật RLS & System Access:** Đã phân định chính xác việc dùng `get_supabase_admin_client` (Service Role Key) cho các tác vụ đặc quyền và `get_supabase_client` cho đọc dữ liệu thông thường.

---

## 2. Danh sách các File đã Refactor (Summary of Changes)

| STT | File / Component | Chi tiết thay đổi chính |
| :--- | :--- | :--- |
| **1** | `ingestion/router.py` | Chuyển Dependency từ `get_db_session` sang `get_supabase_admin_client`. Truyền Supabase Client vào background task. |
| **2** | `auth/application/auth_service.py` | Chuyển logic đăng nhập Google, Email/Password, Register và Refresh Token sang syntax `.table("users")` & `.table("user_sessions")`. Tạm ẩn ghi AuditLog DB. |
| **3** | `auth/router.py` | Cập nhật DI `get_auth_service` injection Supabase Client. |
| **4** | `admin/router.py` | Cập nhật DI `get_admin_service` injection Supabase Client; chuẩn hóa mapping dữ liệu trả về cho Frontend. |
| **5** | `modules/admin/application/admin_service.py` | **Refactor nặng nhất:** Chuyển toàn bộ 10+ hàm quản trị (User, ABAC, Session, AI Analytics, Infra, AuditLogs) sang Supabase REST Query; chuyển SQL Join sang Supabase Relational Select (vd: `users(name, email)`). |
| **6** | `ingestion_gateway.py` | Cập nhật method signature `run_job(job_id, db_client: Client)` và chuyển giao Supabase Client xuống `CVProcessingPipeline`. |
| **7** | `auth_dependencies.py` | Chuyển hàm kiểm tra Session revoking (`get_current_user`) từ SQLAlchemy Query sang Supabase Query `.table("user_sessions").select("is_revoked")`. |

---

## 3. Chi tiết Kỹ thuật theo Module (Technical Breakdown)

### A. Authentication & Authorization Module
* **JWT & Session Revocation:** Middleware `get_current_user` đọc `jti` trực tiếp từ JWT payload và thực hiện query nhanh xuống bảng `user_sessions` bằng Supabase SDK.
* **Role Safety Rails:** Giữ nguyên logic bảo mật trong `update_user` (Không cho phép Admin tự hạ quyền chính mình, không cho phép xóa Admin cuối cùng trong hệ thống).

### B. Admin Management Module
* **Relational Querying:** Đã chuyển đổi các lệnh `JOIN` phức tạp của SQLAlchemy sang syntax Foreign Key Embedding của Supabase:
  ```python
  # Trước (SQLAlchemy): select(UserSession, User).join(User, ...)
  # Sau (Supabase SDK):
  self.client.table("user_sessions").select("*, users(name, email, role)")