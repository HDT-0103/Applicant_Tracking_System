import type { Message } from "./index";

/** Namespace "dashboard" — mỗi key mang cả EN lẫn VI. */
export const dashboardMessages = {
  "dashboard.title": { en: "Dashboard Overview", vi: "Tổng quan bảng điều khiển" },
  "dashboard.welcome": {
    en: "Welcome back! Here's what's happening with your recruitment pipeline today.",
    vi: "Chào mừng trở lại! Đây là tình hình quy trình tuyển dụng của bạn hôm nay.",
  },
  "dashboard.viewAnalytics": { en: "View Analytics", vi: "Xem phân tích" },
  "dashboard.viewAnalyticsHint": { en: "Recruitment metrics and insights", vi: "Số liệu và góc nhìn về tuyển dụng" },

  "dashboard.loadError": { en: "Could not load candidates.", vi: "Không tải được danh sách ứng viên." },
  "dashboard.reviewLoadError": { en: "Could not load review status.", vi: "Không tải được trạng thái duyệt." },
  "dashboard.reviewStatusWarning": {
    en: "Review status could not be loaded, so candidates below are not sorted by review stage.",
    vi: "Không tải được trạng thái duyệt, nên các ứng viên bên dưới chưa được phân theo vòng chấm.",
  },
  "dashboard.sentTo": {
    en: "Interview details sent to {name}.",
    vi: "Đã gửi thông tin phỏng vấn tới {name}.",
  },
  "dashboard.sendError": { en: "Could not send the email.", vi: "Không gửi được email." },
  "dashboard.sendDetails": { en: "Send Details", vi: "Gửi thông tin" },

  "dashboard.repoCount": { en: "{n} repo", vi: "{n} repo" },
  "dashboard.mustHaveTitle": {
    en: "Matches {matched} of {total} required skills",
    vi: "Khớp {matched} trên {total} kỹ năng bắt buộc",
  },
  "dashboard.skillsCount": { en: "{matched}/{total} skills", vi: "{matched}/{total} kỹ năng" },
  "dashboard.matchPct": { en: "{score}% match", vi: "Khớp {score}%" },

  "dashboard.pendingHrDecision": {
    en: "Pending HR Decision (Passed Tech Lead Review)",
    vi: "Chờ HR quyết định (đã qua vòng Tech Lead)",
  },
  "dashboard.readyForScheduling": { en: "Ready for Scheduling", vi: "Sẵn sàng đặt lịch" },
  "dashboard.pendingReview": { en: "Candidates Pending Review", vi: "Ứng viên chờ chấm" },
  "dashboard.noCandidates": { en: "No candidates found", vi: "Không có ứng viên nào" },
  "dashboard.inTechnicalReview": { en: "In Technical Review", vi: "Đang ở vòng kỹ thuật" },
  "dashboard.alreadyDecided": { en: "Already Decided", vi: "Đã có quyết định" },
  "dashboard.scheduledInterviews": { en: "Scheduled Interviews", vi: "Phỏng vấn đã đặt lịch" },
  "dashboard.noScheduled": { en: "No scheduled interviews yet", vi: "Chưa có buổi phỏng vấn nào được đặt lịch" },
} satisfies Record<string, Message>;
