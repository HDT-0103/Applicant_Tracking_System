import type { Message } from "./index";

/** Namespace "auth" — /login, /register, AuthShell, GoogleAuthSlot. Mỗi key mang cả EN lẫn VI. */
export const authMessages = {
  // --- AuthShell (khung chung cho login/register) ---------------------------
  "auth.shell.badge": { en: "Enterprise ATS", vi: "ATS cho doanh nghiệp" },
  "auth.shell.headline": { en: "AI-powered hiring, governed end to end.", vi: "Tuyển dụng bằng AI, kiểm soát từ đầu đến cuối." },
  "auth.shell.blurb": {
    en: "Ingest, enrich, and rank candidates with a security model built for regulated recruiting teams.",
    vi: "Thu nhận, làm giàu và xếp hạng ứng viên với mô hình bảo mật dành cho các đội tuyển dụng cần tuân thủ.",
  },
  "auth.shell.point.ai": { en: "AI verification & semantic candidate ranking", vi: "Xác minh bằng AI & xếp hạng ứng viên theo ngữ nghĩa" },
  "auth.shell.point.abac": { en: "ABAC access control with PII masking", vi: "Kiểm soát truy cập ABAC, che thông tin cá nhân" },
  "auth.shell.point.pgvector": { en: "pgvector search over enriched profiles", vi: "Tìm kiếm pgvector trên hồ sơ đã làm giàu" },

  // --- Login ----------------------------------------------------------------
  "auth.login.heading": { en: "Sign in", vi: "Đăng nhập" },
  "auth.login.subheading": { en: "Access your SmartATS workspace", vi: "Truy cập workspace SmartATS của bạn" },
  "auth.login.noAccount": { en: "Don't have an account?", vi: "Chưa có tài khoản?" },
  "auth.login.createOne": { en: "Create one", vi: "Tạo tài khoản" },
  "auth.login.email": { en: "Email", vi: "Email" },
  "auth.login.emailPlaceholder": { en: "you@company.com", vi: "ban@congty.com" },
  "auth.login.password": { en: "Password", vi: "Mật khẩu" },
  "auth.login.passwordPlaceholder": { en: "Enter your password", vi: "Nhập mật khẩu" },
  "auth.login.submit": { en: "Sign in", vi: "Đăng nhập" },
  "auth.login.submitting": { en: "Signing in…", vi: "Đang đăng nhập…" },
  "auth.login.or": { en: "OR", vi: "HOẶC" },
  "auth.login.sessionExpired": {
    en: "Your session has expired. Please sign in again to continue.",
    vi: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.",
  },
  "auth.login.fillAll": { en: "Please fill in all fields.", vi: "Vui lòng điền đầy đủ các trường." },
  "auth.login.failedCredentials": {
    en: "Authentication failed. Check your credentials.",
    vi: "Đăng nhập thất bại. Kiểm tra lại thông tin đăng nhập.",
  },
  "auth.login.googleNoCredential": {
    en: "Google did not return a valid credential.",
    vi: "Google không trả về thông tin xác thực hợp lệ.",
  },
  "auth.login.failedRetry": { en: "Authentication failed. Please try again.", vi: "Đăng nhập thất bại. Vui lòng thử lại." },
  "auth.login.googleCancelled": {
    en: "Google sign-in was cancelled or failed.",
    vi: "Đăng nhập bằng Google đã bị huỷ hoặc thất bại.",
  },

  // --- Google slot ----------------------------------------------------------
  "auth.google.unavailable": { en: "Google sign-in unavailable", vi: "Không thể đăng nhập bằng Google" },
  "auth.google.signIn": { en: "Sign in with Google", vi: "Đăng nhập bằng Google" },
  "auth.google.signUp": { en: "Sign up with Google", vi: "Đăng ký bằng Google" },

  // --- Register -------------------------------------------------------------
  "auth.register.heading": { en: "Create your account", vi: "Tạo tài khoản" },
  "auth.register.subheading": {
    en: "Pick your role to get started with SmartATS",
    vi: "Chọn vai trò để bắt đầu với SmartATS",
  },
  "auth.register.haveAccount": { en: "Already have an account?", vi: "Đã có tài khoản?" },
  "auth.register.signIn": { en: "Sign in", vi: "Đăng nhập" },
  "auth.register.fullName": { en: "Full name", vi: "Họ và tên" },
  "auth.register.fullNamePlaceholder": { en: "Jane Doe", vi: "Nguyễn Văn A" },
  "auth.register.workEmail": { en: "Work email", vi: "Email công việc" },
  "auth.register.workEmailPlaceholder": { en: "jane@company.com", vi: "an@congty.com" },
  "auth.register.password": { en: "Password", vi: "Mật khẩu" },
  "auth.register.passwordPlaceholder": { en: "Min. 6 characters", vi: "Tối thiểu 6 ký tự" },
  "auth.register.companyName": { en: "Company name", vi: "Tên công ty" },
  "auth.register.companyNamePlaceholder": { en: "Acme Corp", vi: "Công ty ABC" },
  "auth.register.companyWebsite": { en: "Company website (optional)", vi: "Website công ty (tuỳ chọn)" },
  "auth.register.companyWebsitePlaceholder": { en: "https://acme.example", vi: "https://congty.example" },
  "auth.register.joiningAs": { en: "I am joining as", vi: "Tôi tham gia với vai trò" },
  "auth.register.submit": { en: "Create account", vi: "Tạo tài khoản" },
  "auth.register.submitting": { en: "Creating account…", vi: "Đang tạo tài khoản…" },
  "auth.register.adminNote": {
    en: "System administrator access cannot be self-assigned — only an administrator can grant it.",
    vi: "Quyền quản trị hệ thống không thể tự cấp — chỉ quản trị viên mới cấp được.",
  },
  "auth.register.fillRequired": {
    en: "Please fill in all required fields.",
    vi: "Vui lòng điền đầy đủ các trường bắt buộc.",
  },
  "auth.register.failed": { en: "Registration failed.", vi: "Đăng ký thất bại." },
} satisfies Record<string, Message>;
