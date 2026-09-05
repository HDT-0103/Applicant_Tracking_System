import type { Message } from "./index";

/** Dùng chung: nút, trạng thái, role. */
export const commonMessages = {
  "common.save": { en: "Save", vi: "Lưu" },
  "common.cancel": { en: "Cancel", vi: "Huỷ" },
  "common.close": { en: "Close", vi: "Đóng" },
  "common.retry": { en: "Retry", vi: "Thử lại" },
  "common.loading": { en: "Loading…", vi: "Đang tải…" },
  "common.saving": { en: "Saving…", vi: "Đang lưu…" },
  "common.edit": { en: "Edit", vi: "Sửa" },
  "common.delete": { en: "Delete", vi: "Xoá" },
  "common.open": { en: "Open", vi: "Mở" },
  "common.download": { en: "Download", vi: "Tải về" },
  "common.copy": { en: "Copy", vi: "Sao chép" },
  "common.copied": { en: "Copied", vi: "Đã chép" },
  "common.continue": { en: "Continue", vi: "Tiếp tục" },
  "common.back": { en: "Back", vi: "Quay lại" },
  "common.yes": { en: "Yes", vi: "Có" },
  "common.no": { en: "No", vi: "Không" },
  "common.none": { en: "None", vi: "Không có" },
  "common.notProvided": { en: "Not provided.", vi: "Chưa có." },
  "common.dismiss": { en: "Dismiss", vi: "Bỏ qua" },
  "common.unknownError": { en: "Something went wrong.", vi: "Có lỗi xảy ra." },
  "common.notFound": { en: "Not found.", vi: "Không tìm thấy." },
  "common.language": { en: "Language", vi: "Ngôn ngữ" },
  "common.theme": { en: "Theme", vi: "Giao diện" },
  "common.theme.light": { en: "Light", vi: "Sáng" },
  "common.theme.dark": { en: "Dark", vi: "Tối" },
  "common.theme.system": { en: "System", vi: "Theo hệ thống" },

  "role.admin": { en: "Admin", vi: "Quản trị" },
  "role.hr": { en: "HR Manager", vi: "Quản lý tuyển dụng" },
  "role.tech_lead": { en: "Tech Lead", vi: "Tech Lead" },
  "role.hint.hr": {
    en: "Post jobs, screen applicants and schedule interviews. Sees full candidate details.",
    vi: "Đăng tin, sàng lọc hồ sơ và đặt lịch phỏng vấn. Thấy đầy đủ thông tin ứng viên.",
  },
  "role.hint.tech_lead": {
    en: "Review applicants on a panel. Candidate personal details are hidden.",
    vi: "Chấm hồ sơ trong hội đồng. Thông tin cá nhân của ứng viên được che.",
  },

  "status.PUBLISHED": { en: "Published", vi: "Đang tuyển" },
  "status.DRAFT": { en: "Draft", vi: "Nháp" },
  "status.CLOSED": { en: "Closed", vi: "Đã đóng" },

  "candidate.applyingFor": { en: "Applying for: {title}", vi: "Ứng tuyển: {title}" },
  "candidate.generalApplication": { en: "General application", vi: "Ứng tuyển chung" },
  "candidate.anonymous": { en: "Candidate", vi: "Ứng viên" },

  "time.justNow": { en: "Just now", vi: "Vừa xong" },
  "time.minutesAgo": { en: "{n}m ago", vi: "{n} phút trước" },
  "time.hoursAgo": { en: "{n}h ago", vi: "{n} giờ trước" },
  "time.daysAgo": { en: "{n}d ago", vi: "{n} ngày trước" },
} satisfies Record<string, Message>;
