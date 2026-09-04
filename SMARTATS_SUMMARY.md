# SmartATS - Intelligent HR Analytics & Autonomous Agentic System
> **Tài Liệu Kỹ Thuật & Tóm Tắt Toàn Diện Đồ Án**  
> *Hệ thống Theo dõi & Tuyển dụng Ứng viên Thông minh Ứng dụng Trí tuệ Nhân tạo và Phân tích Dữ liệu Đa kênh*

---

## 1. Giới Thiệu Đồ Án (Project Overview)

### 1.1. Bối cảnh & Vấn đề giải quyết (Problem Statement)
Quy trình tuyển dụng nhân sự truyền thống hiện đang đối mặt với nhiều rào cản và tổn thất nghiêm trọng:
- **Tổn thất tài chính & Chi phí cơ hội (Financial Loss):** Theo thống kê từ Hiệp hội Quản trị Nhân sự (SHRM), thời gian tuyển dụng trung bình (*Time-to-Hire*) kéo dài từ 36 đến 42 ngày, gây lãng phí lớn về chi phí nhân công và chậm tiến độ dự án.
- **Nghịch lý nộp trước - duyệt trước (First Come, First Served Dilemma):** Sự mệt mỏi nhận thức (*Cognitive Fatigue*) của chuyên viên tuyển dụng khi sàng lọc hàng trăm CV theo phương pháp tuyến tính dẫn đến tình trạng các ứng viên xuất sắc nộp sau dễ bị bỏ sót hoặc đánh giá thiếu khách quan.
- **Lệch pha giữa Nhân sự và Chuyên môn (HR & Technical Misalignment):** Các nhà tuyển dụng tổng quát (*Generalist Recruiters*) thường gặp khó khăn trong việc đánh giá chính xác năng lực kỹ thuật chuyên sâu (Distributed Systems, Cloud Architecture, CI/CD, v.v.), dẫn đến đánh giá sai lệch tiềm năng của ứng viên.
- **Hạn chế của ATS truyền thống:** Dựa vào cơ chế so khớp từ khóa (*Keyword Matching*) sơ sài, dễ bị đánh lừa bởi thủ thuật nhồi nhét từ khóa (*Keyword Stuffing*) hoặc bỏ qua các ứng viên diễn đạt kỹ năng bằng từ đồng nghĩa.

### 1.2. Mục tiêu của SmartATS
**SmartATS** là nền tảng quản lý tuyển dụng thế hệ mới, dịch chuyển trọng tâm từ quản lý dữ liệu thụ động (CRUD data entry) sang **Hệ thống Phân tích Dữ liệu Nhân sự Chủ động (HR Analytics)** và **Tác tử Tự trị (Autonomous Agentic System)**:
- **Tìm kiếm Ngữ nghĩa (Semantic Search) & LLM Reasoning:** Đọc hiểu ngữ cảnh kinh nghiệm, dự án và bộ kỹ năng trong CV thay vì chỉ đếm từ khóa.
- **Làm giàu Dữ liệu Đa kênh (Cross-Channel Profile Enrichment):** Tự động liên kết và đối soát dữ liệu từ GitHub (mã nguồn, ngôn ngữ lập trình, README.md) và LinkedIn (lịch sử làm việc, bằng cấp chứng chỉ).
- **Hỗ trợ Đánh giá Đa phương (Split-Screen Workspace & Radar Chart):** Cung cấp giao diện trực quan song song giữa bản PDF gốc và bảng phân tích kỹ thuật chuyên sâu.
- **Lên lịch Phỏng vấn Ngữ cảnh (Contextual Scheduling):** Tự động tìm kiếm khoảng thời gian rảnh chung của hội đồng phỏng vấn qua thuật toán đường quét (*Sweep-Line Algorithm*) và đồng bộ Google Calendar/Slack.
- **Bảo mật Dữ liệu Dựa trên Thuộc tính (ABAC):** Tự động che giấu thông tin cá nhân định danh (*PII Masking*) đối với Tech Lead nhằm loại trừ định kiến vô thức (*Unconscious Bias*).

---

## 2. Công Nghệ Sử Dụng (Tech Stack)

Dựa trên phân tích toàn bộ mã nguồn thực tế, hệ thống được xây dựng trên nền tảng công nghệ hiện đại, phân tách rõ ràng giữa Client-side và Server-side:

| Tầng (Layer) | Công nghệ / Thư viện | Vai trò & Mục đích sử dụng |
| :--- | :--- | :--- |
| **Frontend UI** | **Next.js 15.1 (App Router)** | Framework React full-stack, tối ưu SSR và routing |
| | **React 19 & React DOM 19** | Thư viện xây dựng giao diện người dùng |
| | **TypeScript 5.7** | Đảm bảo tính chặt chẽ về mặt kiểu dữ liệu tĩnh |
| | **Tailwind CSS 3.4** | Hệ thống utility-first CSS styling cho giao diện Dark/Light theme chuẩn kỹ thuật |
| | **Recharts 2.15** | Hiển thị biểu đồ năng lực đa chiều (Radar Chart), Time-series Area Chart (Token & Cost) |
| | **Lucide React** | Bộ icon kỹ thuật đồng bộ, trực quan |
| | **@react-oauth/google** | Tích hợp xác thực Google Single Sign-On (SSO) |
| **Backend API** | **Python 3.11+ / FastAPI 0.115** | Framework backend hiệu năng cao, xây dựng REST API & WebSocket |
| | **Uvicorn (ASGI)** | Web server bất đồng bộ chuẩn ASGI |
| | **Pydantic v2 & Pydantic-Settings**| Kiểm thực dữ liệu nghiêm ngặt (Data validation) và quản lý cấu hình hệ thống |
| | **Structlog 24.4** | Logging có cấu trúc theo chuẩn JSON format |
| **Data Extraction**| **PyMuPDF (fitz) & PyPDF 5.1** | Đọc file PDF, bóc tách văn bản thô và trích xuất siêu liên kết ẩn (*Embedded Social Links*) |
| | **python-docx 1.1** | Xử lý tài liệu định dạng Microsoft Word |
| **Database & Cache**| **PostgreSQL 16** | Hệ quản trị cơ sở dữ liệu quan hệ chính |
| | **pgvector 0.3+** | Tiện ích mở rộng lưu trữ và truy vấn vector tương đồng (Vector Database) |
| | **SQLAlchemy 2.0 (Async)** | ORM bất đồng bộ với kết nối qua `psycopg` (binary v3) |
| | **Alembic 1.14** | Quản lý phiên bản và migration cơ sở dữ liệu |
| | **Redis 5.2** | Caching và quản lý phiên làm việc/blacklist token |
| **AI & NLP Engine** | **Google Gemini API (`gemini-2.0-flash`)** | Mô hình ngôn ngữ lớn bóc tách thông tin ứng viên thành JSON có cấu trúc |
| | **Groq Cloud (`qwen/qwen3-32b`, LLaMA)** | Suy luận LLM tốc độ cực cao cho việc phân tích điểm mạnh, điểm yếu |
| | **Sentence-Transformers (`multilingual-e5-base`)** | Mô hình embedding cục bộ đa ngôn ngữ sinh vector 768 chiều |
| | **PyTorch 2.2+ (CPU)** | Runtime nền tảng chạy model embedding cục bộ |
| | **Cosine Similarity Algorithm** | Đo khoảng cách góc cosine giữa vector yêu cầu và hồ sơ ứng viên |
| | **LangChain 0.3 & MCP (Model Context Protocol)**| Khung điều phối Agent và công cụ bối cảnh mô hình |
| **Cloud & DevOps** | **Azure Blob Storage** | Lưu trữ lâu dài tài sản nhị phân CV (PDF) cô lập |
| | **Azure Service Bus** | Message Broker xử lý bất đồng bộ sự kiện tuyển dụng (`cv.received`) |
| | **Google Calendar API & SMTP** | Kiểm tra lịch rảnh/bận, tạo phòng họp và gửi email thông báo |
| | **Slack Incoming Webhooks** | Bắn thông báo thời gian thực về kênh tuyển dụng nội bộ |
| | **Docker & Docker Compose** | Điều phối container hóa toàn bộ hệ thống (Web API + pgvector Database) |

---

## 3. Kiến Trúc Hệ Thống & Sơ Đồ Khối (System Architecture)

### 3.1. Mô hình Kiến trúc Cốt lõi
Hệ thống được thiết kế theo mô hình **Modular Monolith** kết hợp triệt để nguyên lý **Clean Architecture** (Onion Architecture / Hexagonal Architecture):
1. **Domain Layer:** Chứa các thực thể cốt lõi (`CandidateRecord`, `Interviewer`, `ReviewDecision`), các Enums và Interfaces thuần túy, không phụ thuộc framework ngoài.
2. **Application Layer (Use Cases):** Đóng gói logic nghiệp vụ của từng Use Case (`ingestion_service`, `enrichment_service`, `sweep_line_service`, `review_service`, `admin_service`).
3. **Adapters Layer:** Các cổng giao tiếp đầu vào/đầu ra: FastAPI Router endpoints, WebSocket handlers, DTOs/Schemas, Presenters cho UI.
4. **Infrastructure Layer:** Cài đặt cụ thể các tương tác ngoại vi: Kết nối PostgreSQL/pgvector qua SQLAlchemy, Azure Blob Storage SDK, Azure Service Bus SDK, Google API Client, SMTP Notifier, Slack Webhook.

### 3.2. Sơ đồ Luồng Dữ liệu Toàn diện (Data Flow Architecture)

```mermaid
flowchart TD
    subgraph CLIENT["Client Layer (Next.js 15 / React 19)"]
        UI_HOME["Workspace / Upload Zone"]
        UI_SPLIT["Split-Screen Verification Layout"]
        UI_ENRICH["Enriched Profile Dashboard (Radar Chart, Timeline)"]
        UI_SCHED["Contextual Interview Scheduling"]
        UI_ADMIN["Enterprise Admin Control Center"]
    end

    subgraph API_GATEWAY["API Gateway Layer (FastAPI)"]
        MW_AUTH["JWT & Role Guard (ABAC Middleware)"]
        MW_GUARD["Perimeter Guardrails (MIME + 10MB + Magic Bytes %PDF)"]
    end

    subgraph INGEST_BUS["Asynchronous Ingestion & Cloud Backbone"]
        BLOB[("Azure Blob Storage\n(candidate-cvs container)")]
        BUS[/"Azure Service Bus Queue\n(Event: cv.received)"/]
    end

    subgraph AI_CORE["AI Core & Processing Subsystem"]
        PYPDF["PDF Parser & Hyperlink Extractor (pypdf)"]
        GEMINI["Gemini 2.0 Flash / Groq LLM (Schema Extraction)"]
        CRAWLER["Portfolio Enrichment Worker (GitHub API & LinkedIn Scraper)"]
        EMBED_ENG["Sentence-Transformers (multilingual-e5-base: 768-dim)"]
        RANK_ENG["Multi-factor Semantic Ranking Engine (Cosine Similarity)"]
    end

    subgraph PERSISTENCE["Persistence Layer (PostgreSQL 16 + pgvector)"]
        DB_REL[("Relational Tables\n(users, resumes, requirements, meetings, audits)")]
        DB_VEC[("pgvector Embeddings\n(resume_embeddings, requirement_embeddings)")]
    end

    subgraph EXTERNAL["External Ecosystem"]
        GH["GitHub API"]
        LI["LinkedIn Engine"]
        GCAL["Google Calendar API"]
        SLACK["Slack Webhook"]
        SMTP["SMTP Mail Server"]
    end

    %% Client flows
    UI_HOME -->|"1. Multipart Upload (PDF)"| MW_AUTH
    MW_AUTH --> MW_GUARD
    MW_GUARD -->|"2a. Save Binary"| BLOB
    MW_GUARD -->|"2b. Publish Message"| BUS
    MW_GUARD -->|"2c. HTTP 202 Accepted + UUID"| UI_SPLIT

    %% Async processing
    BUS -->|"3. Trigger Job"| PYPDF
    PYPDF -->|"Extract text & embedded links"| GEMINI
    GEMINI -->|"Structured JSON"| CRAWLER
    CRAWLER -->|"Query repos & README"| GH
    CRAWLER -->|"Query experience & certs"| LI
    CRAWLER -->|"Embed (skills, summary, exp)"| EMBED_ENG
    EMBED_ENG -->|"Store 768-dim Vectors"| DB_VEC
    GEMINI -->|"Save Relational Data"| DB_REL

    %% Real-time feedback
    CRAWLER -.->|"4. Push Progress & Radar Data via WebSocket"| UI_ENRICH

    %% Ranking flow
    UI_HOME -->|"Semantic Query"| RANK_ENG
    RANK_ENG <-->|"Vector Search & Cosine Sim"| DB_VEC

    %% Scheduling flow
    UI_SCHED -->|"5. Fetch Availability"| GCAL
    UI_SCHED -->|"6. Sweep-Line Algorithm"| UI_SCHED
    UI_SCHED -->|"7. Confirm Slot"| GCAL
    UI_SCHED -->|"8. Notify Alert"| SLACK
    UI_SCHED -->|"9. Send Calendar Invite"| SMTP

    %% ABAC flow
    UI_ENRICH <-->|"ABAC PII Masking Filter (***)"| MW_AUTH
```

### 3.3. Cấu trúc Thư mục Dự án Thực tế

```text
Applicant_Tracking_System/
├── .env.example                       # Biến môi trường mẫu cho Cloud, DB, LLM, Security
├── Dockerfile                         # Container hóa ứng dụng FastAPI
├── docker-compose.yml                 # Orchestration cho PostgreSQL 16 pgvector & Web API
├── package.json                       # Cấu hình Next.js frontend dependencies & scripts
├── requirements.txt                   # Danh sách dependencies backend gốc
├── start_backend.sh                   # Script khởi động FastAPI trên môi trường Unix/Linux
│
├── docs/                              # 📁 TÀI LIỆU KỸ THUẬT & PHÂN TÍCH THIẾT KẾ
│   ├── analysis&design/               # Thiết kế Azure, Ingestion, Stakeholders Matrix
│   │   ├── azure-architecture.md
│   │   ├── ingestion_module_design_steps.md
│   │   └── stakeholders_matrix.md
│   ├── database_design.md             # Sơ đồ và lược đồ cơ sở dữ liệu
│   └── master_prompt.md               # Đặc tả yêu cầu kỹ thuật và phân công đồ án
│
└── src/                               # 📁 MÃ NGUỒN CHÍNH CỦA HỆ THỐNG
    ├── frontend/                      # 🌐 GIAO DIỆN CLIENT-SIDE (Next.js 15)
    │   ├── app/
    │   │   ├── admin/page.tsx         # Dashboard Quản trị viên (Users, ABAC, AI metrics, Audit)
    │   │   ├── ai-agent-prompt/       # Workspace hiển thị phân tích AI & Radar Chart
    │   │   ├── candidate-profile/     # Trang chi tiết hồ sơ ứng viên
    │   │   │   └── enriched/page.tsx  # Trang hồ sơ sau làm giàu dữ liệu, Review & WebSocket stream
    │   │   ├── login/page.tsx         # Trang đăng nhập Email/Password & Google SSO
    │   │   ├── register/page.tsx      # Trang đăng ký tài khoản tuyển dụng
    │   │   ├── schedule/page.tsx      # Giao diện Lên lịch phỏng vấn theo thuật toán Sweep-Line
    │   │   ├── layout.tsx & page.tsx  # Entrypoint trang chủ và Layout chung
    │   ├── components/                # Reusable UI (IdleUploadZone, AppHeader, FallbackWizard,...)
    │   ├── contexts/                  # AuthContext, WorkspaceContext quản lý State toàn cục
    │   └── services/                  # HTTP Client, ReviewService, SchedulingService
    │
    └── backend/                       # ⚙️ MÁY CHỦ SERVER-SIDE (FastAPI Monolith)
        ├── apps/
        │   └── main.py                # Entrypoint khởi tạo FastAPI Server, CORS, Router mounting
        ├── modules/                   # Các Module nghiệp vụ phân rã Clean Architecture
        │   ├── admin/                 # Quản lý User, ABAC Policy động, Metrics LLM, Audit Logs
        │   │   ├── adapters/routes.py
        │   │   └── application/admin_service.py
        │   ├── auth/                  # Xác thực Google OAuth, JWT, Quản lý tài khoản
        │   │   ├── adapters/routes.py
        │   │   ├── application/auth_service.py
        │   │   └── infra/ (jwt_service.py, google_verifier.py, password_service.py)
        │   ├── ingestion/             # Tiếp nhận file, kiểm thực bảo mật, Azure Storage/Bus
        │   │   ├── adapters/ (routes.py, azure_routes.py)
        │   │   ├── application/ (ingestion_service.py, azure_ingestion_service.py)
        │   │   ├── domain/ (models.py, candidate_repository.py)
        │   │   └── infra/ (azure_blob_service.py, azure_service_bus_service.py)
        │   ├── enrichment/            # Thu thập dữ liệu GitHub/LinkedIn, WebSocket Realtime
        │   │   ├── adapters/routes.py
        │   │   ├── application/ (enrichment_service.py, gemini_parser_service.py)
        │   │   └── domain/models.py
        │   ├── review/                # Cơ chế chấm duyệt hồ sơ kép & giải quyết bất đồng
        │   │   ├── adapters/routes.py
        │   │   ├── application/review_service.py
        │   │   └── domain/models.py
        │   ├── scheduling/            # Thuật toán Sweep-Line, Google Calendar, Slack, SMTP
        │   │   ├── adapters/routes.py
        │   │   ├── application/ (scheduling_service.py, sweep_line_service.py)
        │   │   └── infra/ (google_calendar_service.py, slack_notifier.py, email_notifier.py)
        │   └── shared/                # Hạt nhân dùng chung (ABAC engine, Auth deps, Config)
        │       └── infrastructure/ (abac.py, auth_dependencies.py, config.py)
        │
        └── app/                       # 🧠 LỚP DỊCH VỤ AI, VECTOR SEARCH & PIPELINES
            ├── database/              # Kết nối AsyncSession, SQL Schema migrations
            ├── models/                # SQLAlchemy models (users, resumes, embeddings, abac,...)
            ├── repositories/          # Repository Pattern truy cập cơ sở dữ liệu
            ├── pipelines/             # Pipeline tìm kiếm ứng viên & upload CV
            └── services/              # EmbeddingService, RankingService, LLMService, GroqProvider
```

---

## 4. Các Chức Năng Chính (Core Features)

Dưới đây là chi tiết các chức năng đã được hiện thực hóa trong mã nguồn kèm đường dẫn file và hàm xử lý logic tương ứng:

### 4.1. Module Ingestion & Perimeter Guardrails (Tiếp nhận & Kiểm thực An toàn)
- **Kiểm thực đa tầng bảo vệ (Perimeter Guardrails):**
  - Giới hạn kích thước tệp tối đa 10MB nhằm ngăn chặn tấn công DoS.
  - Kiểm tra MIME Type định dạng tài liệu (`application/pdf`).
  - Xác thực mã nhị phân mở đầu (*Magic Bytes Verification*): Đảm bảo byte mảng đầu tiên bắt đầu bằng `b"%PDF"` để triệt tiêu nguy cơ tải lên mã độc ngụy trang đuôi file.
  - *File xử lý:* `src/backend/modules/ingestion/adapters/routes.py` (hàm `upload_resume`) và `src/backend/modules/ingestion/adapters/azure_routes.py` (hàm `ingest_cv`).
- **Bóc tách Văn bản & Siêu liên kết ẩn (Text & Hyperlink Extraction):**
  - Sử dụng `pypdf.PdfReader` quét qua các đối tượng Annotation của trang PDF (`/Annots -> /Link -> /A -> /URI`) để thu thập các link GitHub và LinkedIn ẩn dưới icon hoặc văn bản neo.
  - Tự động phân tích username GitHub từ URL (loại trừ các URL mặc định như `orgs`, `features`, `marketplace`).
  - *File xử lý:* `src/backend/modules/ingestion/application/ingestion_service.py` (hàm `extract_text_and_links_from_pdf`, `_extract_embedded_links`, `parse_github_and_linkedin_from_links`).
- **Tích hợp Lưu trữ Đám mây & Hàng đợi Sự kiện (Azure Cloud Persistence):**
  - Tải file PDF nhị phân lên Microsoft Azure Blob Storage vào container `candidate-cvs` với tên định danh UUIDv4 không trùng lặp.
  - Phát sự kiện `cv.received` kèm payload JSON lên Azure Service Bus Queue để kích hoạt tiến trình xử lý ngầm.
  - *File xử lý:* `src/backend/modules/ingestion/infra/azure_blob_service.py` (hàm `AzureBlobService.upload_file`) và `src/backend/modules/ingestion/infra/azure_service_bus_service.py` (hàm `AzureServiceBusService.publish_cv_received`).

### 4.2. Module Trí Tuệ Nhân Tạo: Bóc Tách, Embedding & Xếp Hạng Ngữ Nghĩa
- **Trích xuất thông tin cấu trúc bằng LLM (Structured LLM Parsing):**
  - Gửi toàn bộ văn bản thô của CV tới Google Gemini (`gemini-2.0-flash`) hoặc Groq Cloud (`qwen/qwen3-32b`) với nhiệt độ thấp ($T=0.1$) và cấu hình ép buộc trả về định dạng `response_format={"type": "json_object"}`.
  - Bóc tách đầy đủ các trường: `full_name`, `email`, `phone`, `skills`, `experience`, `summary`, `strengths`, `weaknesses`.
  - *File xử lý:* `src/backend/modules/ingestion/application/ingestion_service.py` (`parse_cv_with_gemini`), `src/backend/app/services/llm_service.py` (`LLMService.analyze_resume`), `src/backend/app/services/llm_provider.py` (`GroqProvider.generate_text`).
- **Chuyển đổi Vector Ngữ nghĩa Đa phân đoạn (Multi-Segment Vector Embedding):**
  - Sử dụng mô hình `intfloat/multilingual-e5-base` thông qua thư viện `sentence-transformers` sinh vector 768 chiều.
  - Áp dụng kỹ thuật tiền tố chuẩn của model E5: gắn tiền tố `passage:` cho dữ liệu ứng viên và `query:` cho yêu cầu tuyển dụng.
  - Tách độc lập 3 không gian vector đại diện: `summary_embedding`, `skills_embedding`, `experience_embedding`.
  - *File xử lý:* `src/backend/app/services/embedding_service.py` (hàm `embed_resume`, `embed_requirement`, `embed_text`).
- **Thuật toán Xếp hạng Năng lực Đa yếu tố (Multi-factor Semantic Ranking):**
  - Tính toán độ tương đồng Cosine Similarity trên từng phân đoạn vector giữa JD và CV.
  - Áp dụng công thức tính điểm tổng hợp có trọng số tối ưu cho tuyển dụng:
    $$\text{Final Score} = 0.5 \times \text{Skill Score} + 0.3 \times \text{Experience Score} + 0.2 \times \text{Summary Score}$$
  - Sắp xếp và trả về danh sách ứng viên phù hợp nhất kèm dữ liệu giải trình.
  - *File xử lý:* `src/backend/app/services/ranking_service.py` (hàm `RankingService.rank_one`, `RankingService.rank`), `src/backend/app/pipelines/candidateSearching_pipeline.py` (`SemanticPipeline.rank_all_resumes_for_requirement`).

### 4.3. Module Làm Giàu Dữ Liệu Đa Kênh & WebSocket Trực Tuyến (Profile Enrichment)
- **Thu thập Dữ liệu Chuyên sâu Ngoại vi (GitHub & LinkedIn Crawling):**
  - Chạy tác vụ ngầm (*Background Task*) tự động lấy dữ liệu kho mã nguồn GitHub của ứng viên: đếm số lượng repository công khai, tỷ lệ ngôn ngữ lập trình sử dụng nhiều nhất (Python, Go, TypeScript, Java,...), bóc tách nội dung tệp `README.md` của các dự án nổi bật để chứng thực năng lực thực tế.
  - Đọc và chuẩn hóa dữ liệu LinkedIn (vị trí công việc, công ty, thời gian làm việc, chứng chỉ quốc tế).
  - *File xử lý:* `src/backend/modules/enrichment/application/enrichment_service.py` (hàm `enrichment_worker`, `read_github_json_from_file`, `read_linkedin_json_from_file`).
- **Đồng bộ Tiến trình Realtime qua WebSocket:**
  - Kênh giao tiếp hai chiều WebSocket tại endpoint `/api/enrichment/ws/v1/analysis/{candidate_uuid}`.
  - Phát sóng trạng thái từ `QUEUED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `ENRICHED`, đẩy dữ liệu phân tích ngay khi hoàn tất về giao diện người dùng mà không cần reload trang.
  - *File xử lý:* `src/backend/modules/enrichment/adapters/routes.py` (hàm `sync_candidate_profile`, `websocket_endpoint`).
- **Giao diện Phân tích Trực quan (Visual Analytics Dashboard):**
  - Vẽ biểu đồ Radar Chart tương tác bằng Recharts so sánh chỉ số năng lực kỹ thuật trước và sau khi làm giàu dữ liệu (*Pre vs Post Enrichment*).
  - Dòng thời gian sự nghiệp (*Career Timeline*) chuẩn hóa từ lịch sử công tác.
  - *File xử lý:* `src/frontend/app/candidate-profile/enriched/page.tsx` và `src/frontend/app/ai-agent-prompt/page.tsx`.

### 4.4. Module Lên Lịch Phỏng Vấn Thông Minh (Contextual Scheduling)
- **Thuật toán Đường Quét (Sweep-Line Algorithm):**
  - Giải quyết bài toán tìm khoảng thời gian trống giao nhau giữa nhiều người phỏng vấn (*Interviewer Availability*).
  - Chuyển đổi các khoảng bận/rảnh thành sự kiện thời gian (mỗi mốc bắt đầu tính là $+1$, kết thúc tính là $-1$), sắp xếp theo thứ tự thời gian và quét tìm các cửa sổ giao nhau thỏa mãn điều kiện thời lượng tối thiểu $\ge 45$ phút (khuyến nghị $\ge 60$ phút).
  - *File xử lý:* `src/backend/modules/scheduling/application/sweep_line_service.py` (hàm `SweepLineService.find_slots`).
- **Tích hợp Hệ sinh thái Đa thông báo:**
  - **Google Calendar API:** Quét Free/Busy và tự động chèn lịch hẹn phỏng vấn.
  - **Slack Incoming Webhooks:** Gửi tin nhắn định dạng phong phú thông báo tới kênh HR ngay khi lịch phỏng vấn được chốt.
  - **SMTP Email Service:** Gửi thư mời phỏng vấn tự động kèm thời gian và thông tin phỏng vấn đến ứng viên.
  - *File xử lý:* `src/backend/modules/scheduling/application/scheduling_service.py` (hàm `query_slots`, `confirm_slot`), `src/backend/modules/scheduling/infra/` (`google_calendar_service.py`, `slack_notifier.py`, `email_notifier.py`).

### 4.5. Module Đánh Giá Kép & Giải Quyết Xung Đột (Review & Conflict Resolution)
- **Quy trình Đánh giá Đa vai trò (Dual-Role Review Workflow):**
  - Hỗ trợ cả HR Manager và Tech Lead cùng tham gia đánh giá hồ sơ ứng viên với các quyết định `approved` hoặc `rejected`.
  - Tự động phát hiện trạng thái xung đột (*CONFLICT*) khi một bên phê duyệt còn một bên từ chối.
  - Cung cấp quyền hạn tối cao (*Tie-breaker*) cho HR Manager để đưa ra quyết định giải quyết xung đột cuối cùng (*Resolve Conflict*).
  - *File xử lý:* `src/backend/modules/review/application/review_service.py` (hàm `submit_review`, `get_status`, `resolve_conflict`), `src/backend/modules/review/adapters/routes.py`.

### 4.6. Module Bảo Mật ABAC & Che Giấu Thông Tin Cá Nhân (PII Masking)
- **Cơ chế Kiểm soát Truy cập Dựa trên Thuộc tính (Attribute-Based Access Control):**
  - Khi người dùng đăng nhập bằng vai trò `tech_lead` (hoặc `interviewer`), hệ thống kích hoạt bộ lọc che đệm dữ liệu đệ quy.
  - Tự động thay thế các trường thông tin nhạy cảm: `full_name`, `email`, `phone`, `address`, `salary_expectation` thành `***`.
  - Cho phép Tech Lead xem toàn bộ dữ liệu năng lực kỹ thuật: `github_username`, `linkedin_url`, `skills`, `experience`, `career_timeline`, `technical_skill_matrix`, `match_confidence_score` nhằm loại bỏ định kiến vô thức về giới tính, tuổi tác, địa lý.
  - *File xử lý:* `src/backend/modules/shared/infrastructure/abac.py` (hàm `apply_abac`, chính sách `ABAC_POLICY`).

### 4.7. Module Xác Thực & Quản Trị Hệ Thống (Authentication & Admin Center)
- **Xác thực Đa hình thức:** Hỗ trợ đăng nhập một chạm Google OAuth 2.0 (`/api/auth/google`) thông qua xác thực token phía server với `GoogleTokenVerifier`, song song với đăng nhập Email/Mật khẩu mã hóa BCrypt (`/api/auth/login`, `/api/auth/register`), cấp phát Access Token (JWT) và Refresh Token.
  - *File xử lý:* `src/backend/modules/auth/adapters/routes.py`, `src/backend/modules/auth/application/auth_service.py`.
- **Bảng Điều Khiển Quản Trị Toàn Năng (Admin Control Center - 5 Tabs):**
  1. *User Management:* Quản lý danh sách người dùng, phê duyệt tài khoản mới (`is_approved`), phân quyền (`recruiter`, `interviewer`, `admin`).
  2. *ABAC Dynamic Policies:* Bật/tắt trạng thái ẩn thông tin cho từng tài nguyên và từng trường trực tiếp từ giao diện.
  3. *AI Analytics & Cost Monitoring:* Theo dõi chi phí sử dụng LLM, thống kê tổng token (Prompt + Completion), biểu đồ chuỗi thời gian (Time-series) chi phí qua Recharts AreaChart.
  4. *Infrastructure Health Monitoring:* Kiểm tra trạng thái kết nối cơ sở dữ liệu PostgreSQL Pool, Redis, Azure Blob/Service Bus, dung lượng bộ nhớ.
  5. *Audit Logs & Active Sessions:* Xem toàn bộ lịch sử thao tác hệ thống, danh sách phiên đăng nhập theo Token JTI, địa chỉ IP, User-Agent và quyền thu hồi phiên tức thì (*Revoke Session*).
  - *File xử lý:* `src/frontend/app/admin/page.tsx`, `src/backend/modules/admin/adapters/routes.py`, `src/backend/modules/admin/application/admin_service.py`.

---

## 5. Hướng Dẫn Cài Đặt & Chạy Dự Án (Setup & Installation)

### 5.1. Yêu Cầu Môi Trường (Prerequisites)
- **Hệ điều hành:** Windows 10/11, macOS, hoặc Ubuntu Linux.
- **Node.js:** Phiên bản $\ge$ 18.x (khuyến nghị Node 20 LTS).
- **Python:** Phiên bản 3.11 hoặc 3.12.
- **Cơ sở dữ liệu:** PostgreSQL 16 có cài đặt extension `pgvector` (khuyến nghị chạy qua Docker).
- **Trình quản lý gói:** `npm`, `pnpm`, hoặc `yarn` cho Frontend; `pip` hoặc `venv` cho Backend.

---

### 5.2. Cấu Hình Biến Môi Trường (Environment Variables)
Sao chép tệp `.env.example` thành `.env` tại thư mục gốc của dự án:
```bash
cp .env.example .env
```
Điền các giá trị tham số cần thiết:
```ini
# Application
APP_NAME=SmartATS
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
CORS_ORIGINS=http://localhost:3000

# Frontend Variables
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Database (PostgreSQL + pgvector)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=smartats
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql+psycopg://postgres:your_password@localhost:5432/smartats

# AI & LLM Providers
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Security & JWT
JWT_SECRET=super_secret_key_with_at_least_32_characters_length
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email & Notification (Tùy chọn)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

### 5.3. Khởi Chạy Cơ Sở Dữ Liệu bằng Docker (Database Setup)
Khởi động container PostgreSQL tích hợp sẵn extension `pgvector`:
```bash
docker compose up -d db
```
Sau khi container chạy, khởi tạo lược đồ cơ sở dữ liệu (Schema):
```bash
# Thực thi file SQL khởi tạo
psql -h localhost -U postgres -d smartats -f src/backend/app/database/init_db.sql
psql -h localhost -U postgres -d smartats -f src/backend/app/database/migration.sql
```

---

### 5.4. Cài Đặt & Chạy Backend (FastAPI Server)

1. **Khởi tạo và kích hoạt môi trường ảo Python:**
   - *Trên Windows (PowerShell):*
     ```powershell
     cd src/backend
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - *Trên macOS / Linux:*
     ```bash
     cd src/backend
     python3 -m venv .venv
     source .venv/bin/activate
     ```

2. **Cài đặt thư viện phụ thuộc:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Khởi chạy máy chủ Backend API:**
   - *Từ thư mục gốc dự án (Root) thông qua npm script:*
     ```bash
     npm run backend:dev
     ```
   - *Hoặc khởi chạy trực tiếp bằng Uvicorn:*
     ```bash
     # Đứng tại thư mục gốc dự án:
     uvicorn apps.main:app --reload --host 0.0.0.0 --port 8000 --app-dir src/backend
     ```
   - Swagger API Documentation: Truy cập `http://localhost:8000/docs`

---

### 5.5. Cài Đặt & Chạy Frontend (Next.js App)

1. **Mở một cửa sổ Terminal mới tại thư mục gốc của dự án:**
   ```bash
   npm install
   # Hoặc sử dụng pnpm nếu có sẵn:
   # pnpm install
   ```

2. **Khởi chạy máy chủ phát triển Frontend:**
   ```bash
   npm run dev
   ```

3. **Trải nghiệm ứng dụng:**
   - Truy cập giao diện chính tại địa chỉ: `http://localhost:3000`
   - Đăng nhập với tài khoản HR hoặc Quản trị viên để bắt đầu quy trình nạp hồ sơ, xem bảng phân tích Radar Chart và thử nghiệm điều phối lịch hẹn phỏng vấn.

---

## 6. Đánh Giá & Hướng Phát Triển (Conclusion & Future Work)

### 6.1. Đánh Giá Ưu Điểm của Kiến Trúc Hiện Tại
1. **Kiến trúc Modular Monolith chuẩn mực:** Việc phân rã rành mạch các module nghiệp vụ (`ingestion`, `enrichment`, `scheduling`, `review`, `admin`, `auth`) theo tư tưởng Clean Architecture giúp dự án dễ bảo trì, dễ mở rộng độc lập và sẵn sàng tách thành các Microservices trong tương lai mà không phải đập đi xây lại.
2. **Xử lý Bất đồng bộ & Phản hồi Thời gian thực:** Tách rời khâu tiếp nhận tài liệu (trả về HTTP 202 ngay lập tức) khỏi tác vụ xử lý nặng bằng Azure Service Bus/Background Tasks, kết hợp WebSocket streaming giúp tối ưu trải nghiệm người dùng, triệt tiêu tình trạng lag giật giao diện.
3. **Kết hợp Tối ưu giữa Hybrid AI & Vector Search:** Sử dụng mô hình cục bộ `multilingual-e5-base` kết hợp `pgvector` giúp tiết kiệm chi phí gọi API đám mây cho tác vụ tìm kiếm lặp lại, đồng thời tận dụng sức mạnh suy luận ngữ cảnh sâu của Gemini/Groq cho tác vụ trích xuất dữ liệu phức tạp.
4. **Bảo mật & Đạo đức Tuyển dụng Cao cấp (ABAC):** Cơ chế lọc đệm dữ liệu đệ quy tự động bảo vệ thông tin nhận dạng cá nhân (PII) theo vai trò chuyên biệt là bước đột phá giúp ngăn chặn thiên vị vô thức trong môi trường doanh nghiệp.
5. **Thuật toán Tối ưu Thực tế:** Ứng dụng thành công thuật toán đường quét (*Sweep-Line*) với độ phức tạp thời gian tối ưu $O(N \log N)$ để giải quyết bài toán xung đột lịch phỏng vấn một cách chính xác.

### 6.2. Hạn Chế Còn Tồn Tại & Đề Xuất Hướng Mở Rộng (Future Work)
1. **Hoàn thiện Tác tử Tự trị MCP (Model Context Protocol Autonomous Loop):**
   - Hiện thực hóa đầy đủ tầng `dispatcher.py` và các bộ công cụ trong `src/backend/app/mcp/tools/` (`ranking_tool.py`, `search_tool.py`, `calender_tool.py`) để cho phép AI Agent tự động gọi công cụ giải quyết yêu cầu phức tạp của HR bằng ngôn ngữ tự nhiên thông qua giao diện Chatbot.
2. **Triển khai Đầy đủ Cào Dữ liệu Trực tiếp (Live Crawling Worker):**
   - Thay thế việc đọc tệp mock trong `stored_data/` bằng worker kết nối trực tiếp đến GitHub GraphQL API và LinkedIn Scraper API (Proxycurl/Apify) kèm cơ chế Rate Limiting và Proxy xoay vòng.
3. **Mở rộng Đánh giá Kỹ thuật Tự động (Automated Code Quality Scoring):**
   - Tích hợp thêm module chạy phân tích tĩnh mã nguồn (Static Code Analysis / SonarQube / AST parser) trên các repository công khai của ứng viên để chấm điểm chất lượng code thực tế, độ phức tạp thuật toán và thói quen viết test.
4. **Mở rộng Đa ngôn ngữ & OCR cho CV Dạng Ảnh:**
   - Bổ sung OCR Engine (như Tesseract OCR hoặc Google Cloud Vision) để hỗ trợ các tệp CV dạng hình ảnh scan hoặc thiết kế đồ họa phức tạp (Photoshop/Canva xuất PDF không có text layer).
5. **Tối ưu Hóa Hạ Tầng Cloud Native:**
   - Triển khai hệ thống lên Kubernetes (K8s) hoặc Azure Container Apps với cơ chế tự động mở rộng theo tải (*Horizontal Pod Autoscaling - HPA*), tăng cường giám sát bằng Prometheus và Grafana.
