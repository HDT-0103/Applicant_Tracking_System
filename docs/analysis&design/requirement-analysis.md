# Danh sách yêu cầu từ thông tin khách hàng

## 1. Tóm tắt bối cảnh

- **Lĩnh vực:** Tuyển dụng nhân sự / HR - Hệ thống theo dõi ứng viên (Applicant Tracking System) tích hợp AI
- **Mục tiêu hệ thống:** Tự động hóa quy trình sàng lọc CV bằng cách sử dụng Large Language Models (LLMs) và Semantic Search để hiểu và xếp hạng hồ sơ dựa trên năng lực ngữ cảnh, giảm thiểu thời gian tuyển dụng và loại bỏ thiên kiến con người
- **Người dùng chính:** HR Manager (Quản lý tuyển dụng), Tech Lead (Trưởng nhóm kỹ thuật), Technical Interviewer (Phỏng viên kỹ thuật)
- **Phạm vi ghi nhận:** Tích hợp CV, phân tích AI, xếp hạng ngữ nghĩa, làm giàu hồ sơ từ nguồn bên ngoài (GitHub, LinkedIn), lên lịch phỏng vấn tự động, kiểm soát truy cập dựa trên thuộc tính (ABAC)

## 2. Danh sách màn hình tổng hợp

| Mã | Tên màn hình | Mục đích | Vai trò sử dụng | Ghi chú |
| --- | --- | --- | --- | --- |
| SCR-01 | Google OAuth Unified Authentication | Giao diện đăng nhập tập trung hỗ trợ Google OAuth 2.0 dành cho ứng viên và nhân viên nội bộ (HR Manager, Tech Lead). Yêu cầu cấp quyền đọc Google Calendar để phục vụ tính năng lên lịch phỏng vấn tự động. | Candidate, HR Manager, Tech Lead | Cấp quyền Google Calendar API |
| SCR-02 | Corporate Career Portal | Giao diện hiển thị danh sách các vị trí đang mở tuyển công khai của công ty để ứng viên tìm kiếm và bấm ứng tuyển. | Candidate | Trang chủ tuyển dụng công khai |
| SCR-03 | Candidate Job Application Form | Form điền thông tin cá nhân cơ bản và tải tập tin CV (PDF) lên hệ thống, tự động kích hoạt pipeline phân tích CV. | Candidate | Hỗ trợ định dạng PDF |
| SCR-04 | Central Candidate Directory | Giao diện quản lý toàn bộ ứng viên trong hệ thống (chưa lọc theo pipeline), hiển thị trạng thái xử lý sơ tuyển (Screening, Technical, Final). | HR Manager, Tech Lead | Danh sách ứng viên tổng |
| SCR-05 | Candidate CV Analysis | Giao diện 2 pane (Split-screen) xem chi tiết một ứng viên. Bên trái hiển thị CV gốc đã parse, bên phải hiển thị AI Summary, Điểm Match Score, Average Tenure, Seniority và biểu đồ Radar Skill Alignment. | HR Manager, AI Analytics Engine | Bao gồm thanh công cụ AI Annotations, nút Export và chuyển nhanh tới bảng xếp hạng |
| SCR-06 | Job Description (JD) & Requirement Config Layout | Khung giao diện cấu hình tiêu chí tuyển dụng cho vị trí (vùng Open Role). Cho phép HR/Tech Lead nạp và quản lý các tag kỹ năng bắt buộc (Must-have), kỹ năng ưu tiên (Nice-to-have), mức độ kinh nghiệm yêu cầu và thiết lập thanh kéo "Matching threshold" trực quan để lọc ứng viên. | HR Manager, Tech Lead | Cấu hình JD cho từng Pipeline |
| SCR-07 | Semantic Candidate Ranking | Bảng xếp hạng ứng viên tự động theo độ tương thích ngữ nghĩa của từng Active Pipeline, nằm cạnh khung cấu hình JD. Hiển thị điểm số Match, AI Confidence, các nhãn tín hiệu năng lực (Signals) và nút chuyển nhanh sang trạng thái Phỏng vấn. | HR Manager, Tech Lead | Hiển thị song song với JD Config (SCR-06) |
| SCR-08 | AI Recruitment Assistant | Giao diện chat ngôn ngữ tự nhiên với AI để điều phối tác vụ. Tích hợp khu vực hiển thị trạng thái thực thi (Workflow execution) và bảng quản lý bật/tắt các công cụ (Tool orchestration). | HR Manager, Tech Lead | Workflow execution: semantic_rank, calendar.find_slots, outreach.draft |
| SCR-09 | Contextual Candidate Interview Scheduling | Giao diện tự động tính toán các slot trống chung (Available Interview Slots) từ Google Calendar của hội đồng phỏng vấn (Interview Panel) bằng Sweep-Line algorithm. | HR Manager | Sử dụng Sweep-Line algorithm |
| SCR-10 | Interview Scheduling Exception Handler | Màn hình xử lý ngoại lệ khi không tìm thấy lịch trống chung hoặc lỗi API. Hỗ trợ nút nhắc nhở hội đồng phỏng vấn (Notify Panelists) hoặc cho phép nhập lịch trống thủ công (Enter Available Times Manually). | HR Manager | Xử lý ngoại lệ: No Common Free Slots Found |
| SCR-11 | Admin Control Dashboard & ABAC Security | Giao diện quản trị tối cao của Admin và phân quyền. Cho phép cấu hình quy tắc ABAC động để ẩn thông tin nhạy cảm của ứng viên (Mask PII fields) với Technical Interviewer, quản lý bộ nhớ Vector (pgvector) và giám sát chi phí Token LLM. | System Administrator | Giao diện chuyên sâu cho DevOps & Security |

## 3. Menu 2 cấp đề xuất

| Menu cấp 1 | Menu cấp 2 | Mã màn hình liên quan | ghi chú |
| --- | --- | --- | --- |
| Workspace | All Candidates | SCR-04 | Danh sách ứng viên tổng (chưa lọc theo pipeline) |
|  | CV Analysis | SCR-05 | Xem chi tiết phân tích CV ứng viên (Split-screen) |
|  | Semantic Ranking | SCR-06, SCR-07 | Hiển thị song song JD Config (SCR-06) và bảng xếp hạng (SCR-07) |
|  | AI Assistant | SCR-08 | Giao diện trợ lý điều phối AI |
|  | Interview Scheduling | SCR-09, SCR-10 | Tính toán slot trống (SCR-09) và xử lý ngoại lệ (SCR-10) |
| Active Pipelines | Sr. ML Engineer | SCR-07 | Lọc danh sách ứng viên thuộc pipeline này (142 ứng viên) |
|  | Product Designer | SCR-07 | Lọc danh sách ứng viên thuộc pipeline này (87 ứng viên) |
|  | DevOps Lead | SCR-07 | Lọc danh sách ứng viên thuộc pipeline này (53 ứng viên) |
| Hệ thống | Đăng nhập hệ thống | SCR-01 | Google OAuth Unified Authentication |
|  | Quản trị & Bảo mật ABAC | SCR-11 | Admin Control Dashboard & ABAC Security |
