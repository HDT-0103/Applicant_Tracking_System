import type { Message } from "./index";

/**
 * Namespace "schedule" — màn đặt lịch phỏng vấn và ba hộp thoại đi kèm.
 *
 * Tiền tố: "schedule.*" (app/schedule/page.tsx), "sendDetails.*"
 * (SendDetailsModal), "calendar.*" (RequireCalendarModal), "confirm.*"
 * (ConfirmDialog). Chuỗi tiếng Anh phải giữ NGUYÊN như trước khi tách —
 * test hiện có khớp đúng từng chữ, và không có provider thì t() trả EN.
 */
export const scheduleMessages = {
  // ── Trang đặt lịch ────────────────────────────────────────────────────
  "schedule.slotsCount": { en: "({n} slots)", vi: "({n} khung giờ)" },
  "schedule.connecting": { en: "Connecting Google Calendar...", vi: "Đang kết nối Google Calendar..." },
  "schedule.checkingStatus": { en: "Checking calendar status...", vi: "Đang kiểm tra trạng thái lịch..." },
  "schedule.connect": { en: "Connect Google Calendar", vi: "Kết nối Google Calendar" },
  "schedule.connectBody": {
    en: "To schedule interviews, you need to connect your Google Calendar. This allows the system to check your availability and create calendar events automatically.",
    vi: "Để đặt lịch phỏng vấn, bạn cần kết nối Google Calendar. Hệ thống sẽ dùng nó để kiểm tra thời gian rảnh của bạn và tự động tạo sự kiện trên lịch.",
  },
  "schedule.connectOnce": {
    en: "You only need to do this once. The system will remember your connection.",
    vi: "Bạn chỉ cần làm việc này một lần. Hệ thống sẽ ghi nhớ kết nối của bạn.",
  },
  "schedule.error": { en: "Error", vi: "Lỗi" },
  "schedule.errConnect": {
    en: "Failed to connect Google Calendar: {message}",
    vi: "Không kết nối được Google Calendar: {message}",
  },
  "schedule.errStartConnection": { en: "Failed to start Google connection", vi: "Không khởi động được kết nối Google" },
  "schedule.errSelectInterviewer": {
    en: "Please select at least one interviewer",
    vi: "Vui lòng chọn ít nhất một người phỏng vấn",
  },
  "schedule.errQuerySlots": { en: "Failed to query slots", vi: "Không tìm được khung giờ" },
  "schedule.errInvalidCandidate": {
    en: "Please select a valid candidate before confirming interview schedule.",
    vi: "Vui lòng chọn ứng viên hợp lệ trước khi xác nhận lịch phỏng vấn.",
  },
  "schedule.errConfirmSlot": { en: "Failed to confirm slot", vi: "Không xác nhận được khung giờ" },
  "schedule.breadcrumb": { en: "Schedule Interview", vi: "Đặt lịch phỏng vấn" },
  "schedule.timeSlots": { en: "Time Slots", vi: "Khung giờ" },
  "schedule.candidateLabel": { en: "Candidate:", vi: "Ứng viên:" },
  "schedule.confirmed": { en: "Confirmed", vi: "Đã xác nhận" },
  "schedule.calendarConnected": { en: "Calendar Connected", vi: "Đã kết nối lịch" },
  "schedule.interviewers": { en: "Interviewers", vi: "Người phỏng vấn" },
  "schedule.noInterviewers": {
    en: "No interviewers with connected calendars found.",
    vi: "Không có người phỏng vấn nào đã kết nối lịch.",
  },
  "schedule.from": { en: "From", vi: "Từ" },
  "schedule.to": { en: "To", vi: "Đến" },
  "schedule.min": { en: "{n} min", vi: "{n} phút" },
  "schedule.minutes": { en: "{n} minutes", vi: "{n} phút" },
  "schedule.searching": { en: "Searching...", vi: "Đang tìm..." },
  "schedule.findSlots": { en: "Find Available Slots", vi: "Tìm khung giờ trống" },
  "schedule.availableSlots": { en: "Available Slots ({n})", vi: "Khung giờ trống ({n})" },
  "schedule.selected": { en: "Selected", vi: "Đã chọn" },
  "schedule.emptyHint": {
    en: 'Select interviewers and date range, then click "Find Available Slots"',
    vi: 'Chọn người phỏng vấn và khoảng ngày, rồi bấm "Tìm khung giờ trống"',
  },
  "schedule.interviewConfirmed": { en: "Interview Confirmed", vi: "Đã xác nhận phỏng vấn" },
  "schedule.slotBooked": { en: "Slot has been booked successfully", vi: "Khung giờ đã được đặt thành công" },
  "schedule.start": { en: "Start:", vi: "Bắt đầu:" },
  "schedule.end": { en: "End:", vi: "Kết thúc:" },
  "schedule.interviewersLabel": { en: "Interviewers:", vi: "Người phỏng vấn:" },
  "schedule.nSelected": { en: "{n} selected", vi: "{n} người được chọn" },
  "schedule.eventCreated": { en: "Calendar event created", vi: "Đã tạo sự kiện trên lịch" },
  "schedule.eventSkipped": { en: "Calendar event skipped", vi: "Chưa tạo sự kiện trên lịch" },
  "schedule.emailSentTo": { en: "Email sent to", vi: "Đã gửi email tới" },
  "schedule.theCandidate": { en: "the candidate", vi: "ứng viên" },
  "schedule.emailNotSent": { en: "Email not sent", vi: "Chưa gửi email" },
  "schedule.scheduleAnother": { en: "Schedule Another", vi: "Đặt lịch khác" },
  "schedule.selectedSlot": { en: "Selected Time Slot", vi: "Khung giờ đã chọn" },
  "schedule.details": { en: "Details", vi: "Chi tiết" },
  "schedule.interviewersCount": { en: "Interviewers ({n}):", vi: "Người phỏng vấn ({n}):" },
  "schedule.confirming": { en: "Confirming...", vi: "Đang xác nhận..." },
  "schedule.confirmInterview": { en: "Confirm Interview", vi: "Xác nhận phỏng vấn" },
  "schedule.selectSlotHint": {
    en: "Select a time slot from the center panel to confirm",
    vi: "Chọn một khung giờ ở khung giữa để xác nhận",
  },

  // ── SendDetailsModal ──────────────────────────────────────────────────
  "sendDetails.title": { en: "Send interview details", vi: "Gửi thông tin phỏng vấn" },
  // Giờ phỏng vấn đứng riêng trong <strong> nên câu bị cắt ngay trước nó;
  // cả hai ngôn ngữ đều kết bằng "…, for <giờ>." / "…, vào lúc <giờ>."
  "sendDetails.intro": {
    en: "{name} will receive these exactly as written, for",
    vi: "{name} sẽ nhận đúng nội dung dưới đây, cho buổi phỏng vấn vào lúc",
  },
  "sendDetails.room": { en: "Room *", vi: "Phòng *" },
  "sendDetails.roomPlaceholder": { en: "Meeting Room 4.02", vi: "Phòng họp 4.02" },
  "sendDetails.address": { en: "Address *", vi: "Địa chỉ *" },
  "sendDetails.addressPlaceholder": {
    en: "227 Nguyen Van Cu, District 5, HCMC",
    vi: "227 Nguyễn Văn Cừ, Quận 5, TP.HCM",
  },
  "sendDetails.sending": { en: "Sending…", vi: "Đang gửi…" },
  "sendDetails.send": { en: "Send to candidate", vi: "Gửi cho ứng viên" },

  // ── RequireCalendarModal ──────────────────────────────────────────────
  "calendar.title": { en: "Google Calendar Connection Required", vi: "Cần kết nối Google Calendar" },
  // Tên người dùng nằm trong <strong> giữa hai key này.
  "calendar.welcome": { en: "Welcome,", vi: "Xin chào," },
  "calendar.body": {
    en: "To participate as an interviewer and allow automated interview availability matching, you must connect your Google Calendar.",
    vi: "Để tham gia với vai trò người phỏng vấn và cho phép hệ thống tự động ghép lịch phỏng vấn, bạn cần kết nối Google Calendar.",
  },
  "calendar.errInit": {
    en: "Failed to initialize Google Calendar authentication",
    vi: "Không khởi tạo được xác thực Google Calendar",
  },
  "calendar.redirecting": { en: "Redirecting to Google...", vi: "Đang chuyển tới Google..." },
  "calendar.connectNow": { en: "Connect Google Calendar Now", vi: "Kết nối Google Calendar ngay" },
  "calendar.once": { en: "You only need to connect your calendar once.", vi: "Bạn chỉ cần kết nối lịch một lần." },

  // ── ConfirmDialog ─────────────────────────────────────────────────────
  "confirm.confirm": { en: "Confirm", vi: "Xác nhận" },
  "confirm.working": { en: "Working…", vi: "Đang xử lý…" },
} satisfies Record<string, Message>;
