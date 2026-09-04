import type { Message } from "./index";

/**
 * Namespace "careers" — trang tuyển dụng công khai (ứng viên không có tài
 * khoản). Mỗi key mang cả EN lẫn VI.
 *
 * Bản tiếng Anh phải GIỮ NGUYÊN TỪNG BYTE so với chuỗi cũ trong page.tsx:
 * không có provider thì t() trả tiếng Anh, và screening.test.ts so khớp
 * thông báo lỗi bằng chuỗi. Sửa EN ở đây là đổi hành vi, không phải dịch.
 *
 * Vài câu bị cắt làm hai/ba key (consentA/B/C, results.before/after…) vì giữa
 * chúng có phần tử JSX (tên công ty, tên tin, link). Tiếng Việt vẫn đọc xuôi
 * theo đúng thứ tự ghép đó.
 */
export const careersMessages = {
  // --- Khung trang: topnav, sidebar, banner xem trước ------------------------
  "careers.brand": { en: "Career Page", vi: "Trang tuyển dụng" },
  "careers.nav.careers": { en: "Careers", vi: "Tuyển dụng" },
  "careers.nav.home": { en: "Go to Home Page", vi: "Về trang chủ" },
  "careers.preview.title": { en: "Candidate Portal Preview", vi: "Xem trước cổng ứng viên" },
  "careers.preview.subtitle": { en: "— viewing as a job applicant", vi: "— đang xem với vai trò ứng viên" },
  "careers.preview.back": { en: "← Back to HR Dashboard", vi: "← Về bảng điều khiển HR" },
  "careers.preview.notice": {
    en: "Preview — this is exactly what a candidate sees. Submitting is disabled here.",
    vi: "Xem trước — đây chính xác là những gì ứng viên thấy. Không thể gửi hồ sơ ở chế độ này.",
  },
  "careers.sidebar.open": { en: "Open", vi: "Đang tuyển" },
  "careers.sidebar.position": { en: "Position", vi: "Vị trí" },
  "careers.sidebar.location": { en: "Location", vi: "Địa điểm" },
  "careers.sidebar.mustHave": { en: "Must-Have Skills", vi: "Kỹ năng bắt buộc" },
  "careers.sidebar.niceToHave": { en: "Nice-to-Have Skills", vi: "Kỹ năng ưu tiên" },
  "careers.sidebar.requirements": { en: "Requirements", vi: "Yêu cầu" },
  "careers.sidebar.enrichNote": {
    en: "After applying, your public GitHub and LinkedIn profiles may be enriched to give the hiring team a fuller picture.",
    vi: "Sau khi ứng tuyển, hồ sơ GitHub và LinkedIn công khai của bạn có thể được bổ sung để đội ngũ tuyển dụng có cái nhìn đầy đủ hơn.",
  },
  "careers.job.department": { en: "Department", vi: "Phòng ban" },
  "careers.job.type": { en: "Type", vi: "Hình thức" },
  "careers.job.onsite": { en: "On-site", vi: "Tại văn phòng" },

  // --- Danh sách tin, tin đóng, tin không tồn tại -----------------------------
  "careers.list.heading": { en: "Open positions", vi: "Vị trí đang tuyển" },
  "careers.list.note": {
    en: "Select the role you want to apply for. Your CV is attached to that role only.",
    vi: "Chọn vị trí bạn muốn ứng tuyển. CV của bạn chỉ được gắn với vị trí đó.",
  },
  "careers.list.emptyTitle": { en: "No open positions right now", vi: "Hiện chưa có vị trí nào đang tuyển" },
  "careers.list.emptyBody": {
    en: "There are no roles accepting applications at the moment. Please check back later.",
    vi: "Hiện không có vị trí nào nhận hồ sơ. Vui lòng quay lại sau.",
  },
  "careers.list.detailsInside": { en: "Details inside", vi: "Xem chi tiết" },
  "careers.closed.title": { en: "Applications are closed", vi: "Đã ngừng nhận hồ sơ" },
  "careers.closed.body": {
    en: "is no longer accepting applications. Browse our other open roles at",
    vi: "không còn nhận hồ sơ nữa. Xem các vị trí khác đang tuyển tại",
  },
  "careers.notFound.title": { en: "Position not found", vi: "Không tìm thấy vị trí" },
  "careers.notFound.body": {
    en: "This link may be outdated or the posting was removed. See our",
    vi: "Liên kết này có thể đã cũ hoặc tin tuyển dụng đã bị gỡ. Xem",
  },
  "careers.notFound.link": { en: "open positions", vi: "các vị trí đang tuyển" },

  // --- Lỗi ứng viên nhìn thấy (chi tiết kỹ thuật ở lại log) -------------------
  "careers.error.loadFailed": { en: "Failed to load job postings", vi: "Không tải được danh sách tin tuyển dụng" },
  "careers.error.noJob": { en: "No job selected for this application.", vi: "Chưa chọn vị trí để ứng tuyển." },
  "careers.error.submitFailed": {
    en: "We could not submit your application. Please check your file and try again — if it keeps happening, contact us.",
    vi: "Chúng tôi chưa gửi được hồ sơ của bạn. Vui lòng kiểm tra lại tệp và thử lại — nếu vẫn lỗi, hãy liên hệ với chúng tôi.",
  },
  "careers.error.updateFailed": {
    en: "We could not save your changes. Please try again in a moment.",
    vi: "Chúng tôi chưa lưu được thay đổi của bạn. Vui lòng thử lại sau giây lát.",
  },

  // --- Màn chờ và màn kết quả -----------------------------------------------
  "careers.loading.savingTitle": { en: "Saving your changes…", vi: "Đang lưu thay đổi…" },
  "careers.loading.savingBody": { en: "Updating the answers on your application.", vi: "Đang cập nhật câu trả lời trong hồ sơ của bạn." },
  "careers.loading.title": { en: "Processing your application…", vi: "Đang xử lý hồ sơ của bạn…" },
  "careers.loading.body": {
    en: "Enriching your profile with public GitHub and LinkedIn data.",
    vi: "Đang bổ sung hồ sơ của bạn bằng dữ liệu công khai từ GitHub và LinkedIn.",
  },
  "careers.loading.step.parse": { en: "Parsing resume", vi: "Đang đọc CV" },
  "careers.loading.step.github": { en: "Fetching GitHub activity", vi: "Đang lấy hoạt động GitHub" },
  "careers.loading.step.linkedin": { en: "Scanning LinkedIn profile", vi: "Đang quét hồ sơ LinkedIn" },
  "careers.results.title": { en: "Thank you!", vi: "Cảm ơn bạn!" },
  "careers.results.before": { en: "Your application for", vi: "Hồ sơ ứng tuyển của bạn cho vị trí" },
  "careers.results.submittedAfter": {
    en: "has been submitted. We will be in touch at the email address on your CV.",
    vi: "đã được gửi. Chúng tôi sẽ liên hệ qua địa chỉ email trong CV của bạn.",
  },
  "careers.results.updatedAfter": {
    en: "has been updated. We will be in touch at the email address on your CV.",
    vi: "đã được cập nhật. Chúng tôi sẽ liên hệ qua địa chỉ email trong CV của bạn.",
  },
  "careers.results.edit": { en: "Review or edit your application", vi: "Xem lại hoặc chỉnh sửa hồ sơ" },

  // --- Form ứng tuyển ---------------------------------------------------------
  "careers.form.resume": { en: "Resume / CV", vi: "Hồ sơ / CV" },
  "careers.form.fileMeta": { en: "{kb} KB · PDF", vi: "{kb} KB · PDF" },
  "careers.form.release": { en: "Release to upload", vi: "Thả để tải lên" },
  "careers.form.attach": { en: "Attach resume / CV", vi: "Đính kèm hồ sơ / CV" },
  "careers.form.fileHint": { en: "PDF only · Max 10 MB ·", vi: "Chỉ nhận PDF · Tối đa 10 MB ·" },
  "careers.form.browse": { en: "Browse files", vi: "Chọn tệp" },
  "careers.form.resumeRequired": { en: "Please upload your CV", vi: "Vui lòng tải lên CV của bạn" },
  "careers.form.alreadyApplied": { en: "You already applied for this position", vi: "Bạn đã ứng tuyển vị trí này" },
  "careers.form.onDate": { en: "on", vi: "vào ngày" },
  "careers.form.prefilledNote": {
    en: ". Your previous answers are pre-filled below — change anything you like and save.",
    vi: ". Câu trả lời trước đó đã được điền sẵn bên dưới — bạn có thể sửa bất kỳ mục nào rồi lưu lại.",
  },
  "careers.form.resumeOnFile": { en: "Submitted with your original application", vi: "Đã gửi cùng hồ sơ ban đầu" },
  "careers.form.resumeKept": {
    en: "Your CV on file is kept. To submit a different CV, please contact the hiring team.",
    vi: "CV đã nộp của bạn được giữ nguyên. Nếu muốn gửi CV khác, vui lòng liên hệ đội ngũ tuyển dụng.",
  },
  "careers.form.cvNote": {
    en: "We read your name, contact details and links straight from the CV — no need to retype them.",
    vi: "Chúng tôi đọc tên, thông tin liên hệ và các liên kết trực tiếp từ CV — bạn không cần nhập lại.",
  },
  "careers.form.salary": { en: "Expected monthly salary", vi: "Mức lương mong muốn hằng tháng" },
  "careers.form.salaryTo": { en: "to", vi: "đến" },
  "careers.form.workMode": { en: "Preferred working arrangement", vi: "Hình thức làm việc mong muốn" },
  "careers.form.workModeHint": { en: "Select all that work for you", vi: "Chọn tất cả hình thức phù hợp với bạn" },
  "careers.form.availability": { en: "When can you start?", vi: "Khi nào bạn có thể bắt đầu?" },
  "careers.form.skills": {
    en: "How strong are you on this role's skills?",
    vi: "Bạn tự đánh giá thế nào về các kỹ năng của vị trí này?",
  },
  "careers.form.skillsScale": { en: "1 = just starting · 5 = expert", vi: "1 = mới bắt đầu · 5 = chuyên gia" },
  "careers.form.workStyle": { en: "How do you prefer to work?", vi: "Bạn thích làm việc theo cách nào?" },
  "careers.form.motivation": { en: "What is driving your move?", vi: "Điều gì thúc đẩy bạn thay đổi công việc?" },
  "careers.form.optional": { en: "(Optional)", vi: "(Không bắt buộc)" },
  "careers.form.motivationPlaceholder": { en: "Anything you would like to add", vi: "Bạn muốn chia sẻ thêm điều gì?" },
  "careers.form.consentA": { en: "I agree that", vi: "Tôi đồng ý để" },
  "careers.form.consentB": {
    en: "may store and process my CV and the answers above — including public data from the GitHub and LinkedIn profiles I provided — to assess my fit for the",
    vi: "lưu trữ và xử lý CV cùng các câu trả lời ở trên — bao gồm dữ liệu công khai từ hồ sơ GitHub và LinkedIn tôi đã cung cấp — để đánh giá mức độ phù hợp của tôi với vị trí",
  },
  "careers.form.consentC": {
    en: "position. I can request deletion of my data at any time.",
    vi: "này. Tôi có thể yêu cầu xoá dữ liệu của mình bất cứ lúc nào.",
  },
  "careers.form.update": { en: "Update Application", vi: "Cập nhật hồ sơ" },
  "careers.form.submit": { en: "Submit Application", vi: "Gửi hồ sơ" },
  "careers.form.aiNotice": {
    en: "We may use AI tools to support parts of the hiring process, such as reviewing applications and analysing CVs. These tools assist our recruitment team but do not replace human judgment — final hiring decisions are made by people.",
    vi: "Chúng tôi có thể dùng công cụ AI để hỗ trợ một phần quy trình tuyển dụng, như xem xét hồ sơ và phân tích CV. Các công cụ này hỗ trợ đội ngũ tuyển dụng nhưng không thay thế đánh giá của con người — quyết định tuyển dụng cuối cùng do con người đưa ra.",
  },
  "careers.form.poweredBy": { en: "Jobs powered by", vi: "Tin tuyển dụng vận hành bởi" },

  // --- Nhãn lựa chọn của bộ câu hỏi sàng lọc (lib/screening.ts) ---------------
  // Giá trị (onsite, hybrid…) là dữ liệu ghi vào DB nên không đổi; chỉ nhãn dịch.
  "careers.screening.workMode.onsite": { en: "Full-time onsite", vi: "Toàn thời gian tại văn phòng" },
  "careers.screening.workMode.hybrid": { en: "Hybrid", vi: "Kết hợp (hybrid)" },
  "careers.screening.workMode.remote": { en: "Fully remote", vi: "Làm việc từ xa hoàn toàn" },
  "careers.screening.availability.immediate": { en: "Immediately", vi: "Ngay lập tức" },
  "careers.screening.availability.two_weeks": { en: "In 2 weeks", vi: "Sau 2 tuần" },
  "careers.screening.availability.one_month": { en: "In 1 month", vi: "Sau 1 tháng" },
  "careers.screening.availability.other": { en: "Another date", vi: "Ngày khác" },
  "careers.screening.motivation.growth": { en: "New challenges", vi: "Thử thách mới" },
  "careers.screening.motivation.promotion": { en: "Better growth path", vi: "Lộ trình phát triển tốt hơn" },
  "careers.screening.motivation.pivot": { en: "Changing direction", vi: "Chuyển hướng sự nghiệp" },
  "careers.screening.motivation.other": { en: "Something else", vi: "Lý do khác" },
  "careers.screening.workStyle.independent": { en: "Independent", vi: "Độc lập" },
  "careers.screening.workStyle.independent.hint": {
    en: "Give me the goal, I will find the way",
    vi: "Cho tôi mục tiêu, tôi sẽ tự tìm cách",
  },
  "careers.screening.workStyle.collaborative": { en: "Collaborative", vi: "Hợp tác" },
  "careers.screening.workStyle.collaborative.hint": {
    en: "I like constant discussion and feedback",
    vi: "Tôi thích thường xuyên trao đổi và nhận phản hồi",
  },
  "careers.screening.workStyle.structured": { en: "Structured", vi: "Có quy trình" },
  "careers.screening.workStyle.structured.hint": {
    en: "I work best with clear processes and checklists",
    vi: "Tôi làm việc tốt nhất với quy trình và danh sách việc rõ ràng",
  },
  "careers.screening.salaryBasis.gross": { en: "Gross", vi: "Gross (trước thuế)" },
  "careers.screening.salaryBasis.net": { en: "Net", vi: "Net (sau thuế)" },
  "careers.screening.rating.1": { en: "Just starting", vi: "Mới bắt đầu" },
  "careers.screening.rating.2": { en: "Basic", vi: "Cơ bản" },
  "careers.screening.rating.3": { en: "Comfortable", vi: "Khá" },
  "careers.screening.rating.4": { en: "Proficient", vi: "Thành thạo" },
  "careers.screening.rating.5": { en: "Expert", vi: "Chuyên gia" },

  // --- Thông báo kiểm tra của validateScreening -------------------------------
  "careers.screening.error.salaryRange": { en: "Please give your expected range", vi: "Vui lòng cho biết khoảng lương mong muốn" },
  "careers.screening.error.salaryOrder": { en: "Maximum must be greater than the minimum", vi: "Mức tối đa phải lớn hơn mức tối thiểu" },
  "careers.screening.error.workMode": { en: "Select at least one working arrangement", vi: "Chọn ít nhất một hình thức làm việc" },
  "careers.screening.error.availability": { en: "Please select when you can start", vi: "Vui lòng chọn thời điểm bạn có thể bắt đầu" },
  "careers.screening.error.availabilityDate": { en: "Please specify your start date", vi: "Vui lòng chọn ngày bắt đầu" },
  "careers.screening.error.skills": {
    en: "Please rate all {total} skills ({left} left)",
    vi: "Vui lòng đánh giá đủ {total} kỹ năng (còn {left})",
  },
  "careers.screening.error.workStyle": { en: "Please select your preferred working style", vi: "Vui lòng chọn cách làm việc bạn thích" },
  "careers.screening.error.consent": { en: "We need your consent to process this application", vi: "Chúng tôi cần sự đồng ý của bạn để xử lý hồ sơ này" },
} satisfies Record<string, Message>;
