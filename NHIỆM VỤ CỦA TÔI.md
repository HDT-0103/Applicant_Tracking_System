Dựa vào toàn bộ dữ liệu từ file Đề xuất dự án (**Template0**), Đặc tả yêu cầu (**Template1**) và cấu trúc thư mục thực tế của nhóm bạn, mình xin phân tích rõ ràng và bóc tách chính xác **vị trí thư mục/file** bạn cần làm việc (bao gồm cả phần Code và phần Báo cáo) để bạn không bị nhầm lẫn với các thành viên khác:

---

### I. PHẦN CODE (Toàn bộ nằm trong `/src`)

Với vai trò **Full-Stack & Integration Engineer**, bạn chịu trách nhiệm chính về giao diện hiển thị kết quả phân tích và các module tích hợp dịch vụ bên ngoài. Cụ thể:

#### 1. Frontend (Next.js) — Code tại thư mục `src/frontend/src/`

Hiện tại Trí đã làm xong khung bọc ngoài (`App.tsx` và `WorkspaceContext.tsx`), việc của bạn là code nội dung hiển thị bên trong **Panel bên phải** khi trạng thái là `SUCCESS`:

* **Vẽ Biểu đồ kỹ năng (Radar Chart):** Code cấu phần biểu đồ để render mảng dữ liệu `skills: {name: string, score: number}[]` nhận từ WebSocket.
* *Nơi code:* Tạo file component mới trong `src/frontend/src/components/`.


* **Vẽ Dòng thời gian sự nghiệp động (SVG Career Timeline):** Render mảng dữ liệu `trajectory` dưới dạng đồ họa SVG trực quan để hiển thị lịch sử làm việc của ứng viên.
* *Nơi code:* Tạo file component mới trong `src/frontend/src/components/`.


* **Giao diện Workspace hoàn chỉnh (`AiAnalyticsWorkspace`):** Kết hợp các cấu phần trên (Thông tin cá nhân, Điểm số, Biểu đồ kỹ năng, Dòng thời gian) thành một màn hình Analytics Hub hoàn chỉnh ở bên phải.
* *Nơi code:* Tạo file view trong `src/frontend/src/views/`.



#### 2. Backend (FastAPI / Python) — Code tại thư mục `src/backend/modules/`

Bạn phụ trách tích hợp và đồng bộ hóa dữ liệu với các nền tảng của bên thứ ba:

* **Đồng bộ dữ liệu (Data Synchronization):** Kết nối dữ liệu thu thập được từ GitHub/LinkedIn (do module `portfolio-enrich` của thành viên khác xử lý) vào luồng lưu trữ hoặc xuất dữ liệu cho Frontend.
* *Nơi code:* Phối hợp xử lý tại `src/backend/modules/portfolio-enrich/`.


* **Tự động xếp lịch phỏng vấn (Automated Scheduling):** Tích hợp sâu với **Google Calendar API** (sử dụng các biến môi trường `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, v.v. đã khai báo trong file `.env.example`) để quét lịch trống của các Tech Lead và đề xuất khung giờ phù hợp.
* *Nơi code:* Khởi tạo các hàm xử lý lịch trình trong `src/backend/modules/notification/`.


* **Tích hợp thông báo Slack:** Code logic gọi các endpoint **Slack Webhooks** để tự động bắn tin nhắn thông báo lên channel chung của phòng nhân sự khi lịch phỏng vấn được chốt thành công.
* *Nơi code:* Viết các hàm đẩy payload thông báo tại `src/backend/modules/notification/`.



---

### II. PHẦN BÁO CÁO & TÀI LIỆU (Toàn bộ nằm trong `/docs` và File Template gốc)

Dựa theo quy trình Công nghệ Phần mềm và phân chia task trên JIRA, bạn chịu trách nhiệm viết tài liệu cho các mục sau:

#### 1. Trong file `/Template1-RequirementAnalysis.md` (ở thư mục gốc):

* **Mục `#### Stakeholders` (Task AP-33):** Bạn vừa làm xong phần này, bao gồm việc giải trình chi tiết về 12 tác nhân liên quan và thiết kế mã nguồn sơ đồ **System Context Diagram** bằng Mermaid.js.
* **Mục Kịch bản Use Case (Use Case Specification) cho tính năng đặt lịch:** Khi nhóm làm đến các Use Case tiếp theo (ví dụ: *U002 - Automated Interview Scheduling*), bạn sẽ phải là người viết bảng đặc tả kịch bản chính (Main Scenario), kịch bản thay thế (Alternative Scenarios) và điều kiện tiên quyết giống như bảng mẫu U001 mà Trí đã dựng.
* **Mục Prototype / Mockup giao diện:** Thiết kế giao diện (bằng Figma/Draw.io) cho màn hình Workspace hiển thị kết quả phân tích (bên phải) và màn hình cấu hình đặt lịch phỏng vấn tự động để chèn vào tài liệu.

#### 2. Trong các thư mục tài liệu chuyên biệt của `/docs`:

* **Đặc tả tích hợp API ngoài (`/docs/requirements/`):** Viết tài liệu làm rõ cấu trúc dữ liệu nhận về từ Google Calendar API và cấu trúc payload gửi đi cho Slack Webhooks.
* **Tài liệu Đóng góp Thành viên (`/Template1-RequirementAnalysis.md` -> Mục `# Member Contribution Assessment`):** Chụp ảnh màn hình các task JIRA mang tên bạn (ví dụ: `AP-33`) ở trạng thái **Done**, kèm link các Pull Request (PR) hoặc commit Git của nhánh `docs/ap-33-...` dán vào phần thông tin cá nhân của bạn để làm bằng chứng đóng góp (Evidence) cho giảng viên chấm điểm.