
# VIỆC CẦN LÀM ĐẦU TIÊN

Chính xác luôn Toàn ơi! Để hệ thống **SmartATS** chạy được ở chế độ thực tế (**Real Mode**) bảo mật và đúng chuẩn doanh nghiệp, luồng **Đăng nhập (Authentication)** và **Phân quyền (Authorization)** là bước đầu tiên cực kỳ quan trọng cần được hoàn thiện.

Nhìn vào cấu hình `.env.example` và thiết kế dự án, dưới đây là phần bạn cần code tiếp cho hệ thống đăng nhập:

### 1. Phía Frontend (`src/frontend`)

Hiện tại giao diện của bạn đang vào thẳng không gian làm việc (`App.tsx`). Bạn cần xây dựng thêm luồng chặn Auth:

* **Tạo màn hình Login (`Login.tsx`):** Thiết kế một giao diện đăng nhập sạch sẽ bằng TailwindCSS. Vì dự án định hướng tích hợp sâu với hệ sinh thái Google (như Google Calendar để xếp lịch phỏng vấn), bạn cần ưu tiên tích hợp **Google OAuth2** (Sử dụng thư viện `@react-oauth/google` hoặc tự dựng nút gọi Authentication URL).
* **Quản lý State và Token:** * Sau khi user đăng nhập thành công, lưu `accessToken` và `refreshToken` vào `localStorage` hoặc `Secure Cookie`.
* Bọc toàn bộ ứng dụng trong một lớp bảo mật Context mới (ví dụ: `AuthContext.tsx`) để kiểm tra nếu chưa có token thì tự động chuyển hướng (redirect) về trang `/login`.


* **Cập nhật Axios/Fetch Interceptor:** Viết một cấu hình HttpClient chung để tự động đính kèm Header `Authorization: Bearer <token>` vào tất cả các request API gửi đi từ `WorkspaceContext.tsx` (như endpoint upload file CV).

### 2. Phía Backend / Gateway

Dựa trên tệp cài đặt, bạn cần code các API Endpoint sau (thường nằm ở cụm module `auth/` phía backend):

* **Endpoint `/api/auth/google`:** Tiếp nhận Authorization Code từ Frontend gửi lên, thực hiện trao đổi với Google Server để lấy `id_token` và thông tin Profile của HR/Recruiter.
* **Xử lý JWT (JSON Web Token):** * Tạo mã JWT chứa thông tin của User (ID, Email, Vai trò: Recruiter/Interviewer).
* Code Middleware xác thực token cho các request tiếp theo (đảm bảo chỉ có user đã đăng nhập mới được gọi API upload file CV hay xem phân tích AI).


* **Tích hợp biến môi trường:** Sử dụng đúng các key đã khai báo trong tệp cấu hình của dự án:
* `GOOGLE_CLIENT_ID`
* `GOOGLE_CLIENT_SECRET`
* `GOOGLE_REDIRECT_URI`
* `JWT_SECRET` (cần bổ sung để ký mã token bảo mật)



### Gợi ý thứ tự làm cho bạn:

1. **Bổ sung UI Login:** Code nhanh một form Login có nút "Sign in with Google".
2. **Cấu hình luồng OAuth2 Frontend:** Lấy `client_id` từ file `.env` chạy thử nghiệm luồng mở pop-up đăng nhập của Google để lấy về mã Access Token/Code thành công.
3. **Viết API kiểm tra Token ở Backend:** Đảm bảo khi frontend gửi CV kèm mã token trong Header, backend sẽ giải mã và biết chính xác ai (`Nguyễn Khánh Toàn` hay một HR nào khác) đang thực hiện thao tác upload này để lưu vết (Audit Log).

Phần đăng nhập này sẽ tạo nền tảng cực tốt để sau đó bạn code tiếp tính năng **Tự động xếp lịch phỏng vấn qua Google Calendar** ở các bước sau!