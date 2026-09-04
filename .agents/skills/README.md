# 🚀 Hướng Dẫn Sử Dụng Thư Mục Skills (`.agents/skills`) - SmartATS

Chào mừng bạn đến với tài liệu hướng dẫn sử dụng bộ kỹ năng chuyên biệt (**Skills**) thuộc hệ thống **SmartATS (Applicant Tracking System)**. 

Thư mục `.agents/skills` chứa 12 quy chuẩn kiến trúc, tài liệu nghiệp vụ, hướng dẫn AI agent và quy trình kỹ thuật được đóng gói theo dạng **Antigravity / Agentic Skill Standard**. Bộ tài liệu này giúp các AI Agent (Antigravity, Cursor, Copilot, ...) và Lập trình viên nắm bắt chính xác kiến trúc hệ thống, tránh vi phạm các quy tắc thiết kế và duy trì chất lượng mã nguồn doanh nghiệp.

---

## 📌 1. Danh Sách 12 Skills Hỗ Trợ Trong Hệ Thống

Dưới đây là danh sách tổng hợp 12 skills cùng thông tin chi tiết:

| # | Tên Skill | Đường Dẫn `SKILL.md` | Phạm Vi & Mục Đích Chính |
|---|---|---|---|
| 1 | **`ats-business-domain`** | [`ats-business-domain/SKILL.md`](.agents/skills/ats-business-domain/SKILL.md) | Nghiệp vụ ATS enterprise: Vòng đời ứng viên, state machine chuyển trạng thái, quy trình phỏng vấn scorecard, phân quyền các vai trò (Recruiter, HR Manager, Tech Lead, Admin, Interviewer). |
| 2 | **`cv-analysis-semantic-ranking`** | [`cv-analysis-semantic-ranking/SKILL.md`](.agents/skills/cv-analysis-semantic-ranking/SKILL.md) | Phân tích CV bằng Gemini 2.0 Flash, bóc tách thông tin liên hệ/social links, tạo ma trận kỹ năng 5 trục (Backend, Frontend, Cloud Dev, InfoSec, ML/AI) và hiển thị giao diện split-screen workspace. |
| 3 | **`ingestion-azure-pipeline`** | [`ingestion-azure-pipeline/SKILL.md`](.agents/skills/ingestion-azure-pipeline/SKILL.md) | Pipeline nạp file CV PDF: Kiểm tra tính hợp lệ file (magic bytes %PDF, size 10MB), tải lên Azure Blob Storage (container `candidate-cvs`), đẩy event vào Azure Service Bus queue (`cv-received-queue`) và lưu Supabase. |
| 4 | **`enrichment-multi-source`** | [`enrichment-multi-source/SKILL.md`](.agents/skills/enrichment-multi-source/SKILL.md) | Thu thập dữ liệu đa nguồn: Cào profile GitHub qua REST API (repos, languages, README), dữ liệu LinkedIn qua Apify scraper Actor `GOvL4O4RwFqsdIqXF` / Renidly API và đẩy event thời gian thực qua WebSocket `/api/enrichment/ws/v1/analysis/{uuid}`. |
| 5 | **`auth-google-supabase`** | [`auth-google-supabase/SKILL.md`](.agents/skills/auth-google-supabase/SKILL.md) | Đăng nhập Google OAuth 2.0 (`/api/auth/google`), quản lý JWT token (Access/Refresh `/api/auth/refresh`), xác thực và phân quyền vai trò với Supabase `users` table (`allowed_roles = {'hr', 'tech_lead'}`) cùng env fallback. |
| 6 | **`backend-api-standards`** | [`backend-api-standards/SKILL.md`](.agents/skills/backend-api-standards/SKILL.md) | Chuẩn REST API FastAPI, Clean Architecture, Repository Pattern, Pydantic v2 DTO, xử lý lỗi toàn cục và phân trang/lọc dữ liệu. |
| 7 | **`frontend-nextjs-workspace`** | [`frontend-nextjs-workspace/SKILL.md`](.agents/skills/frontend-nextjs-workspace/SKILL.md) | Kiến trúc Frontend Next.js 15 App Router, React 19, giao diện split-screen workspace, biểu đồ radar Recharts và kết nối WebSocket realtime. |
| 8 | **`database-schema-standards`** | [`database-schema-standards/SKILL.md`](.agents/skills/database-schema-standards/SKILL.md) | Chuẩn Cơ sở dữ liệu PostgreSQL & Supabase, đánh chỉ mục (B-Tree, JSONB GIN, Vector Index), bảo mật Row Level Security (RLS) và SQL migration. |
| 9 | **`security-governance`** | [`security-governance/SKILL.md`](.agents/skills/security-governance/SKILL.md) | Bảo mật hệ thống: Phân quyền RBAC/ABAC, che giấu dữ liệu nhạy cảm PII, phòng chống Prompt Injection / SQL Injection / XSS và ghi log kiểm toán structlog. |
| 10 | **`ai-governance-eval`** | [`ai-governance-eval/SKILL.md`](.agents/skills/ai-governance-eval/SKILL.md) | Quản trị và Đánh giá AI: Kiểm soát Prompt Injection, đánh giá độ chính xác của Gemini parsing, quản lý LLM token budget và fallback rule-based parser khi API gặp lỗi. |
| 11 | **`shared-infrastructure`** | [`shared-infrastructure/SKILL.md`](.agents/skills/shared-infrastructure/SKILL.md) | Hạ tầng dùng chung: FastAPI App Factory, Pydantic BaseSettings (GEMINI_API_KEY, SUPABASE_URL, AZURE_*), khởi tạo Supabase Client (Anon/Admin), structlog logging và CORS. |
| 12 | **`testing-quality-assurance`** | [`testing-quality-assurance/SKILL.md`](.agents/skills/testing-quality-assurance/SKILL.md) | Tiêu chuẩn kiểm thử QA: Pytest backend, FastAPI TestClient, mock dịch vụ ngoài (Gemini, Azure, Apify, GitHub), Jest/RTL frontend và regression test. |

---

## 🛠️ 2. Cấu Trúc Mỗi Thư Mục Skill

Mỗi thư mục skill được tổ chức chuẩn hóa như sau:

```text
.agents/skills/<skill-name>/
├── SKILL.md                 # (Bắt buộc) File chứa hướng dẫn chính + YAML frontmatter
├── agents/                  # (Tùy chọn) Định nghĩa subagent chuyên biệt (openai.yaml)
├── references/              # (Tùy chọn) Tài liệu tham khảo sâu hoặc tài liệu kỹ thuật
└── scripts/                 # (Tùy chọn) Các script tự động hóa hoặc tiện ích kiểm tra
```

### Chi Tiết Cấu Trúc File `SKILL.md`:
* **YAML Frontmatter (Đầu file)**:
  * `name`: Tên định danh của skill.
  * `description`: Tóm tắt ngắn gọn tính năng.
  * `tech_stack`: Danh sách các công nghệ áp dụng.
  * `when_to_use`: Các trường hợp cụ thể kích hoạt skill.
* **Nội dung Markdown**: Trình bày chi tiết luồng dữ liệu, quy tắc kiến trúc, danh sách file nên/không nên sửa, và các lỗi anti-pattern cần tránh.

---

## 💡 3. Hướng Dẫn Kích Hoạt & Sử Dụng

### Đối Với AI Coding Assistant (Antigravity / Cursor / Copilot)

1. **Đọc `SKILL.md` trước khi sửa code**: Khi thực hiện nhiệm vụ liên quan đến một mô-đun (ví dụ: viết API FastAPI, sửa UI Next.js, viết SQL migration, hay chỉnh sửa luồng OAuth), AI **phải đọc file `SKILL.md` tương ứng** thông qua công cụ đọc file.
2. **Kích hoạt dựa trên `when_to_use`**:
   - Khi phát triển API mới: Đọc [`backend-api-standards/SKILL.md`](.agents/skills/backend-api-standards/SKILL.md).
   - Khi thêm/sửa bảng CSDL: Đọc [`database-schema-standards/SKILL.md`](.agents/skills/database-schema-standards/SKILL.md).
   - Khi sửa màn hình Dashboard / Workspace: Đọc [`frontend-nextjs-workspace/SKILL.md`](.agents/skills/frontend-nextjs-workspace/SKILL.md).
   - Khi thay đổi trạng thái ứng viên: Đọc [`ats-business-domain/SKILL.md`](.agents/skills/ats-business-domain/SKILL.md).
   - Khi viết unit test hoặc mock service: Đọc [`testing-quality-assurance/SKILL.md`](.agents/skills/testing-quality-assurance/SKILL.md).

### Đối Với Lập Trình Viên (Developers)

- **Tra cứu quy chuẩn**: Sử dụng các file `SKILL.md` như một bộ Guidelines nội bộ để nắm rõ thiết kế hệ thống.
- **Onboarding thành viên mới**: Thành viên mới có thể bắt đầu bằng đọc [`ats-business-domain/SKILL.md`](.agents/skills/ats-business-domain/SKILL.md) và [`shared-infrastructure/SKILL.md`](.agents/skills/shared-infrastructure/SKILL.md) để hiểu toàn cảnh dự án.

---

## 🗺️ 4. Bảng Tra Cứu Skill Theo Mô-Đun Code (Mapping Matrix)

| Vị Trí Thư Mục Trong Codebase | Skill Cần Tham Khảo |
|---|---|
| `src/backend/apps/` & `src/backend/modules/*/adapters/` | [`backend-api-standards`](.agents/skills/backend-api-standards/SKILL.md), [`security-governance`](.agents/skills/security-governance/SKILL.md) |
| `src/backend/modules/ingestion/` | [`ingestion-azure-pipeline`](.agents/skills/ingestion-azure-pipeline/SKILL.md) |
| `src/backend/modules/enrichment/` | [`cv-analysis-semantic-ranking`](.agents/skills/cv-analysis-semantic-ranking/SKILL.md), [`enrichment-multi-source`](.agents/skills/enrichment-multi-source/SKILL.md) |
| `src/backend/modules/auth/` & `src/frontend/contexts/AuthContext.tsx` | [`auth-google-supabase`](.agents/skills/auth-google-supabase/SKILL.md) |
| `src/frontend/` (Next.js components, pages, hooks) | [`frontend-nextjs-workspace`](.agents/skills/frontend-nextjs-workspace/SKILL.md) |
| Database Schemas / Migrations / Supabase RLS | [`database-schema-standards`](.agents/skills/database-schema-standards/SKILL.md) |
| Core Infrastructure, Settings, Logging | [`shared-infrastructure`](.agents/skills/shared-infrastructure/SKILL.md) |
| Unit Tests / Integration Tests (`tests/`) | [`testing-quality-assurance`](.agents/skills/testing-quality-assurance/SKILL.md) |

---

## ⚡ 5. Nguyên Tắc Quan Trọng Khi Phát Triển (Core Constraints)

1. **Không nhảy cóc State Machine**: Trạng thái ứng viên (`status`) phải tuân theo luồng `CREATED -> PARSED -> QUEUED -> IN_PROGRESS -> ENRICHED`.
2. **Bảo mật PII & ABAC**: Luôn ẩn/mã hóa PII khi hiển thị ứng viên cho người dùng không thuộc quyền xem.
3. **Mocking dịch vụ ngoài khi Test**: Không bao giờ gọi trực tiếp Gemini API hay Azure thật trong môi trường Test tự động; luôn dùng Pytest Fixtures/Mocks theo hướng dẫn trong `testing-quality-assurance`.
4. **Đồng bộ hóa Enum Vai Trò (UserRole)**: Các vai trò chuẩn hệ thống gồm `recruiter`, `interviewer`, `admin`, `hr`, `hr_manager`, `tech_lead`.

---
*Tài liệu được khởi tạo tự động cho dự án **SmartATS (v4.2.1)**.*
