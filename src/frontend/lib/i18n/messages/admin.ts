import type { Message } from "./index";

/** Namespace "admin" — trang /admin. Mỗi key mang cả EN lẫn VI. */
export const adminMessages = {
  // --- Sidebar / tabs -------------------------------------------------------
  "admin.console": { en: "Admin Console", vi: "Bảng quản trị" },
  "admin.nav.users": { en: "Users & Access", vi: "Người dùng & Quyền truy cập" },
  "admin.nav.abac": { en: "ABAC & Security", vi: "ABAC & Bảo mật" },
  "admin.nav.ai": { en: "AI & Vector", vi: "AI & Vector" },
  "admin.nav.infra": { en: "Infrastructure", vi: "Hạ tầng" },
  "admin.nav.audit": { en: "Audit Trail", vi: "Nhật ký kiểm toán" },

  // --- Errors ---------------------------------------------------------------
  "admin.error.generic": { en: "Error", vi: "Lỗi" },
  "admin.error.loadMetrics": { en: "Failed to load dashboard metrics", vi: "Không tải được số liệu bảng điều khiển" },
  "admin.error.updateUser": { en: "Failed to update user: {message}", vi: "Không cập nhật được người dùng: {message}" },
  "admin.error.togglePolicy": { en: "Failed to toggle policy: {message}", vi: "Không bật/tắt được chính sách: {message}" },
  "admin.error.revokeSession": { en: "Failed to revoke session: {message}", vi: "Không thu hồi được phiên: {message}" },
  "admin.error.reindex": { en: "Failed to re-index vectors: {message}", vi: "Không đánh lại chỉ mục vector được: {message}" },

  // --- Revoke session dialog ------------------------------------------------
  "admin.revoke.title": { en: "Revoke this session?", vi: "Thu hồi phiên này?" },
  "admin.revoke.message": {
    en: "The user will be signed out immediately and will have to log in again. Any work they have not saved is lost.",
    vi: "Người dùng sẽ bị đăng xuất ngay lập tức và phải đăng nhập lại. Mọi thay đổi chưa lưu sẽ mất.",
  },
  "admin.revoke.confirm": { en: "Revoke session", vi: "Thu hồi phiên" },

  // --- Users & Access -------------------------------------------------------
  "admin.users.title": { en: "Users & Access", vi: "Người dùng & Quyền truy cập" },
  "admin.users.subtitle": {
    en: "Approve accounts and grant roles. New sign-ups start as recruiters; elevate to interviewer or admin here.",
    vi: "Duyệt tài khoản và cấp vai trò. Tài khoản mới đăng ký bắt đầu là nhân sự tuyển dụng; nâng lên người phỏng vấn hoặc quản trị tại đây.",
  },
  "admin.users.col.user": { en: "User", vi: "Người dùng" },
  "admin.users.col.current": { en: "Current", vi: "Hiện tại" },
  "admin.users.col.assignRole": { en: "Assign Role", vi: "Gán vai trò" },
  "admin.users.col.approved": { en: "Approved", vi: "Đã duyệt" },
  "admin.users.col.action": { en: "Action", vi: "Thao tác" },
  "admin.users.empty": { en: "No users found.", vi: "Không có người dùng nào." },

  // --- ABAC & sessions ------------------------------------------------------
  "admin.abac.title": { en: "Attribute-Based Access Control", vi: "Kiểm soát truy cập theo thuộc tính" },
  "admin.abac.subtitle": {
    en: "Toggle real-time PII masking per role (e.g. interviewer) without editing backend code.",
    vi: "Bật/tắt che thông tin cá nhân theo từng vai trò (vd. người phỏng vấn) ngay lập tức, không cần sửa mã backend.",
  },
  "admin.abac.col.targetRole": { en: "Target Role", vi: "Vai trò áp dụng" },
  "admin.abac.col.resource": { en: "Resource", vi: "Tài nguyên" },
  "admin.abac.col.field": { en: "PII Field", vi: "Trường PII" },
  "admin.abac.col.strategy": { en: "Strategy", vi: "Cách che" },
  "admin.abac.col.masked": { en: "Masked", vi: "Đang che" },
  "admin.abac.replaceWith": { en: "Replace “{pattern}”", vi: "Thay bằng “{pattern}”" },
  "admin.sessions.title": { en: "Active JWT Sessions", vi: "Phiên JWT đang hoạt động" },
  "admin.sessions.subtitle": {
    en: "Revoke a token to force immediate re-authentication.",
    vi: "Thu hồi token để buộc xác thực lại ngay lập tức.",
  },
  "admin.sessions.col.user": { en: "User", vi: "Người dùng" },
  "admin.sessions.col.role": { en: "Role", vi: "Vai trò" },
  "admin.sessions.col.ip": { en: "IP", vi: "IP" },
  "admin.sessions.col.issued": { en: "Issued", vi: "Cấp lúc" },
  "admin.sessions.col.status": { en: "Status", vi: "Trạng thái" },
  "admin.sessions.col.action": { en: "Action", vi: "Thao tác" },
  "admin.sessions.revoked": { en: "Revoked", vi: "Đã thu hồi" },
  "admin.sessions.active": { en: "Active", vi: "Đang hoạt động" },
  "admin.sessions.kill": { en: "Kill Token", vi: "Huỷ token" },

  // --- AI & Vector ----------------------------------------------------------
  "admin.ai.title": { en: "AI Engine Cost & Vector Analytics", vi: "Chi phí AI & Phân tích vector" },
  "admin.ai.subtitle": {
    en: "Monitor token/cost utilisation and trigger pgvector re-indexing.",
    vi: "Theo dõi mức dùng token/chi phí và kích hoạt đánh lại chỉ mục pgvector.",
  },
  "admin.ai.stat.cost": { en: "Estimated Total Cost", vi: "Tổng chi phí ước tính" },
  "admin.ai.stat.tokens": { en: "Total Tokens", vi: "Tổng token" },
  "admin.ai.stat.promptTokens": { en: "Prompt Tokens", vi: "Token đầu vào" },
  "admin.ai.stat.completionTokens": { en: "Completion Tokens", vi: "Token đầu ra" },
  "admin.ai.dailyCost": { en: "Daily API Cost", vi: "Chi phí API theo ngày" },
  "admin.ai.reindex.title": { en: "pgvector re-indexing", vi: "Đánh lại chỉ mục pgvector" },
  "admin.ai.reindex.body": {
    en: "Rebuild HNSW / IVFFlat indexes on the embedding tables.",
    vi: "Dựng lại chỉ mục HNSW / IVFFlat trên các bảng embedding.",
  },
  "admin.ai.reindex.running": { en: "Rebuilding…", vi: "Đang dựng lại…" },
  "admin.ai.reindex.run": { en: "Run Vector Re-Index", vi: "Chạy đánh lại chỉ mục" },
  "admin.ai.byModel": { en: "Token Consumption by Model", vi: "Mức dùng token theo mô hình" },
  "admin.ai.col.model": { en: "Model", vi: "Mô hình" },
  "admin.ai.col.calls": { en: "Calls", vi: "Lượt gọi" },
  "admin.ai.col.tokens": { en: "Tokens", vi: "Token" },
  "admin.ai.col.cost": { en: "Cost (USD)", vi: "Chi phí (USD)" },
  "admin.ai.unpriced": { en: "no price list", vi: "chưa có giá" },
  "admin.ai.empty": { en: "No LLM usage recorded.", vi: "Chưa ghi nhận lượt dùng LLM nào." },

  // --- Infrastructure -------------------------------------------------------
  "admin.infra.title": { en: "Infrastructure & Queue Monitoring", vi: "Giám sát hạ tầng & hàng đợi" },
  "admin.infra.subtitle": {
    en: "Azure Service Bus, ingestion retries, and third-party API rate limits.",
    vi: "Azure Service Bus, số lần thử lại khi thu nhận, và hạn mức API bên thứ ba.",
  },
  "admin.infra.serviceBus": { en: "Azure Service Bus", vi: "Azure Service Bus" },
  "admin.infra.queue": { en: "Queue", vi: "Hàng đợi" },
  "admin.infra.activeMessages": { en: "Active Messages", vi: "Tin đang chờ" },
  "admin.infra.deadletter": { en: "Deadletter", vi: "Deadletter" },
  "admin.infra.status.healthy": { en: "healthy", vi: "ổn định" },
  "admin.infra.status.degraded": { en: "degraded", vi: "suy giảm" },
  "admin.infra.status.unavailable": { en: "unavailable", vi: "không truy cập được" },
  "admin.infra.status.not_configured": { en: "not configured", vi: "chưa cấu hình" },
  "admin.infra.rateLimits": { en: "API Rate Limits", vi: "Hạn mức API" },
  "admin.infra.noRateLimits": {
    en: "No provider has reported a rate limit yet.",
    vi: "Chưa có nhà cung cấp nào báo hạn mức.",
  },
  "admin.infra.resets": { en: "Resets: {time}", vi: "Đặt lại lúc: {time}" },

  // --- Audit trail ----------------------------------------------------------
  "admin.audit.title": { en: "Compliance Audit Trail", vi: "Nhật ký kiểm toán tuân thủ" },
  "admin.audit.subtitle": {
    en: "Searchable log of system actions mapped by user_id and candidate_uuid.",
    vi: "Nhật ký thao tác hệ thống có thể tìm kiếm, gắn theo user_id và candidate_uuid.",
  },
  "admin.audit.searchPlaceholder": { en: "Search by action, user, keyword…", vi: "Tìm theo thao tác, người dùng, từ khoá…" },
  "admin.audit.search": { en: "Search", vi: "Tìm" },
  "admin.audit.col.timestamp": { en: "Timestamp", vi: "Thời điểm" },
  "admin.audit.col.operator": { en: "Operator", vi: "Người thao tác" },
  "admin.audit.col.action": { en: "Action", vi: "Thao tác" },
  "admin.audit.col.network": { en: "Network", vi: "Mạng" },
  "admin.audit.col.details": { en: "Details", vi: "Chi tiết" },
  "admin.audit.notRecorded": { en: "not recorded", vi: "không ghi nhận" },
  "admin.audit.noMatch": { en: "No audit trail matches “{query}”.", vi: "Không có bản ghi nào khớp “{query}”." },
  "admin.audit.empty": { en: "No audit trails recorded yet.", vi: "Chưa có bản ghi kiểm toán nào." },
} satisfies Record<string, Message>;
