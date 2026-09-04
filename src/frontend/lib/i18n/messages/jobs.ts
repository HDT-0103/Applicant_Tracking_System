import type { Message } from "./index";

/**
 * Namespace "jobs" — mỗi key mang cả EN lẫn VI.
 *
 *   jobs.wizard.*  — /job-postings/create (wizard 3 bước)
 *   jobs.detail.*  — /job-postings/[id]
 *   jobs.panel.*   — ReviewPanelPicker
 *   jobs.share.*   — ShareLinkBox
 *
 * Bản EN phải giữ NGUYÊN chuỗi cũ: test component render không có provider
 * và khớp đúng câu tiếng Anh. Giá trị option của <select> (department,
 * work mode, seniority, employment type) được LƯU vào DB nên chỉ dịch nhãn.
 */
export const jobsMessages = {
  // ---- ShareLinkBox --------------------------------------------------------
  "jobs.share.label": { en: "Public application link", vi: "Link ứng tuyển công khai" },
  "jobs.share.hint": {
    en: "Share this link anywhere. Every CV submitted through it is attached to this job only.",
    vi: "Chia sẻ link này ở bất cứ đâu. Mọi CV nộp qua link sẽ chỉ gắn với tin này.",
  },

  // ---- ReviewPanelPicker ---------------------------------------------------
  "jobs.panel.title": { en: "Review panel", vi: "Hội đồng chấm" },
  "jobs.panel.loadError": { en: "Could not load the panel.", vi: "Không tải được hội đồng." },
  "jobs.panel.changeError": { en: "That change did not go through.", vi: "Thay đổi chưa được áp dụng." },
  "jobs.panel.saveFirst": {
    en: "Save this posting first, then choose who reviews the applications.",
    vi: "Lưu tin trước, rồi chọn người chấm hồ sơ.",
  },
  "jobs.panel.rule.lead": {
    en: "Only these Tech Leads can open applications for this posting, and",
    vi: "Chỉ những Tech Lead này mới được mở hồ sơ ứng tuyển vào tin, và",
  },
  "jobs.panel.rule.count": { en: "{needed} of {total}", vi: "{needed} trên {total} người" },
  "jobs.panel.rule.none": { en: "none of them", vi: "chưa có ai" },
  "jobs.panel.rule.tail": {
    en: "must approve before it reaches HR.",
    vi: "phải duyệt trước khi hồ sơ tới HR.",
  },
  "jobs.panel.loading": { en: "Loading panel…", vi: "Đang tải hội đồng…" },
  "jobs.panel.empty": {
    en: "No reviewers yet — this posting cannot be published, and any application to it would sit unreviewed.",
    vi: "Chưa có người chấm — tin này chưa thể đăng, và hồ sơ nộp vào sẽ không được ai xem.",
  },
  "jobs.panel.remove": { en: "Remove {name}", vi: "Gỡ {name}" },
  "jobs.panel.allInvited": { en: "Every Tech Lead is on this panel.", vi: "Mọi Tech Lead đều đã trong hội đồng." },

  // ---- Job posting detail --------------------------------------------------
  "jobs.detail.loadError": { en: "This job posting could not be loaded.", vi: "Không tải được tin tuyển dụng này." },
  "jobs.detail.notFound": { en: "Job posting not found.", vi: "Không tìm thấy tin tuyển dụng." },
  "jobs.detail.postedBy": { en: "Posted by {name}", vi: "Đăng bởi {name}" },
  "jobs.detail.created": { en: "Created {date}", vi: "Tạo ngày {date}" },
  "jobs.detail.published": { en: "Published {date}", vi: "Đăng ngày {date}" },
  "jobs.detail.expires": { en: "Expires {date}", vi: "Hết hạn {date}" },
  "jobs.detail.tab.posting": { en: "Job posting", vi: "Tin tuyển dụng" },
  "jobs.detail.tab.candidate": { en: "Candidate view", vi: "Góc nhìn ứng viên" },
  "jobs.detail.openPublic": { en: "Open public page", vi: "Mở trang công khai" },
  "jobs.detail.fact.location": { en: "Location", vi: "Địa điểm" },
  "jobs.detail.fact.department": { en: "Department", vi: "Phòng ban" },
  "jobs.detail.fact.employmentType": { en: "Employment type", vi: "Hình thức làm việc" },
  "jobs.detail.fact.workMode": { en: "Work mode", vi: "Chế độ làm việc" },
  "jobs.detail.fact.seniority": { en: "Seniority", vi: "Cấp bậc" },
  "jobs.detail.fact.openings": { en: "Openings", vi: "Số lượng tuyển" },
  "jobs.detail.fact.salary": { en: "Salary", vi: "Mức lương" },
  "jobs.detail.salary.from": { en: "From {n}", vi: "Từ {n}" },
  "jobs.detail.salary.upTo": { en: "Up to {n}", vi: "Tối đa {n}" },
  "jobs.detail.section.overview": { en: "Overview", vi: "Tổng quan" },
  "jobs.detail.section.responsibilities": { en: "Key responsibilities", vi: "Trách nhiệm chính" },
  "jobs.detail.section.requirements": { en: "Requirements", vi: "Yêu cầu" },
  "jobs.detail.section.niceToHave": { en: "Nice-to-have qualifications", vi: "Ưu tiên thêm" },
  "jobs.detail.skills.must": { en: "Must-have skills", vi: "Kỹ năng bắt buộc" },
  "jobs.detail.skills.nice": { en: "Nice-to-have skills", vi: "Kỹ năng ưu tiên" },
  "jobs.detail.skills.none": { en: "None listed", vi: "Chưa liệt kê" },
  "jobs.detail.panel.empty": { en: "No Tech Lead has been invited yet.", vi: "Chưa mời Tech Lead nào." },
  "jobs.detail.previewNote": {
    en: "This is the live application page a candidate sees. Submitting is disabled in this preview.",
    vi: "Đây là trang ứng tuyển thật mà ứng viên nhìn thấy. Nút nộp hồ sơ bị tắt trong bản xem trước này.",
  },

  // ---- Create / edit wizard: step indicator --------------------------------
  "jobs.wizard.step1": { en: "1. Job Details", vi: "1. Chi tiết vị trí" },
  "jobs.wizard.step2": { en: "2. Preview Card", vi: "2. Thẻ xem trước" },
  "jobs.wizard.step3": { en: "3. Candidate View Portal", vi: "3. Cổng ứng viên" },

  // ---- Wizard: shared inputs -----------------------------------------------
  "jobs.wizard.tags.added": { en: "{n} added", vi: "Đã thêm {n}" },
  "jobs.wizard.tags.empty": {
    en: "No skills added yet — type above and press Enter",
    vi: "Chưa có kỹ năng nào — gõ ở trên rồi nhấn Enter",
  },
  "jobs.wizard.chars": { en: "{n} chars", vi: "{n} ký tự" },
  "jobs.wizard.fmt.bold": { en: "Bold", vi: "Đậm" },
  "jobs.wizard.fmt.italic": { en: "Italic", vi: "Nghiêng" },
  "jobs.wizard.fmt.code": { en: "Code", vi: "Mã" },
  "jobs.wizard.fmt.list": { en: "List", vi: "Danh sách" },
  "jobs.wizard.fmt.paragraph": { en: "Paragraph", vi: "Đoạn văn" },

  // ---- Wizard: preview card ------------------------------------------------
  "jobs.wizard.preview.titlePlaceholder": { en: "Job Title", vi: "Tên vị trí" },
  "jobs.wizard.preview.deptPlaceholder": { en: "Department", vi: "Phòng ban" },
  "jobs.wizard.preview.locPlaceholder": { en: "Location", vi: "Địa điểm" },
  "jobs.wizard.preview.modePlaceholder": { en: "On-site", vi: "Tại văn phòng" },
  "jobs.wizard.preview.workModePlaceholder": { en: "Work Mode", vi: "Chế độ làm việc" },
  "jobs.wizard.preview.open": { en: "Open", vi: "Đang mở" },
  "jobs.wizard.preview.mustHave": { en: "Must-Have Skills", vi: "Kỹ năng bắt buộc" },
  "jobs.wizard.preview.niceToHave": { en: "Nice-to-Have", vi: "Ưu tiên" },
  "jobs.wizard.preview.more": { en: "+{n} more", vi: "+{n} nữa" },
  "jobs.wizard.preview.apply": { en: "Apply Now", vi: "Ứng tuyển ngay" },

  // ---- Wizard: publish modal -----------------------------------------------
  "jobs.wizard.publish.title": { en: "Job Description Published!", vi: "Đã đăng tin tuyển dụng!" },
  "jobs.wizard.publish.yourPosition": { en: "Your position", vi: "Vị trí của bạn" },
  "jobs.wizard.publish.live": {
    en: "is now live and accepting applications.",
    vi: "đã được đăng và đang nhận hồ sơ.",
  },
  "jobs.wizard.publish.badge.live": { en: "Live on Portal", vi: "Hiển thị trên cổng" },
  "jobs.wizard.publish.badge.apps": { en: "Accepting Apps", vi: "Đang nhận hồ sơ" },
  "jobs.wizard.publish.badge.ai": { en: "AI Enrichment On", vi: "Đã bật làm giàu AI" },
  "jobs.wizard.publish.body": {
    en: "Candidates can now discover and apply for this position. Profile enrichment via GitHub and LinkedIn is active for all submissions.",
    vi: "Ứng viên đã có thể tìm thấy và ứng tuyển vào vị trí này. Làm giàu hồ sơ qua GitHub và LinkedIn được bật cho mọi hồ sơ nộp vào.",
  },
  "jobs.wizard.publish.continue": { en: "Continue Editing", vi: "Tiếp tục chỉnh sửa" },

  // ---- Wizard: validation / save state -------------------------------------
  "jobs.wizard.err.noPanel": {
    en: "Add at least one Tech Lead to the review panel before publishing — applications to a posting with no panel cannot be reviewed by anyone.",
    vi: "Hãy thêm ít nhất một Tech Lead vào hội đồng chấm trước khi đăng — hồ sơ nộp vào tin không có hội đồng sẽ không ai chấm được.",
  },
  "jobs.wizard.err.titleRequired": { en: "Job title is required!", vi: "Tên vị trí là bắt buộc!" },
  "jobs.wizard.err.saveFailed": { en: "Save failed", vi: "Lưu thất bại" },
  "jobs.wizard.header.editHint": { en: "Click to edit position title", vi: "Bấm để sửa tên vị trí" },
  "jobs.wizard.header.placeholder": { en: "Enter position title (Required)...", vi: "Nhập tên vị trí (Bắt buộc)..." },
  "jobs.wizard.header.empty": { en: "Position Title (Required) *", vi: "Tên vị trí (Bắt buộc) *" },
  "jobs.wizard.header.help": {
    en: "Position title is required. Click the title or pencil icon to edit directly.",
    vi: "Tên vị trí là bắt buộc. Bấm vào tiêu đề hoặc biểu tượng bút để sửa trực tiếp.",
  },
  "jobs.wizard.save.saved": { en: "Draft saved", vi: "Đã lưu nháp" },
  "jobs.wizard.save.unsaved": { en: "Unsaved", vi: "Chưa lưu" },
  "jobs.wizard.loading": { en: "Loading position details...", vi: "Đang tải thông tin vị trí..." },

  // ---- Wizard step 1: position details ------------------------------------
  "jobs.wizard.card.details": { en: "Position Details", vi: "Chi tiết vị trí" },
  "jobs.wizard.field.title": { en: "Job Title", vi: "Tên vị trí" },
  "jobs.wizard.field.requiredMark": { en: "* (Required)", vi: "* (Bắt buộc)" },
  "jobs.wizard.field.titlePlaceholder": {
    en: 'e.g. "Senior ML Engineer" or "Mobile Security Engineer Intern"',
    vi: 'VD: "Senior ML Engineer" hoặc "Thực tập sinh Kỹ sư Bảo mật Di động"',
  },
  "jobs.wizard.field.titleEmpty": {
    en: "Position title is required and cannot be empty.",
    vi: "Tên vị trí là bắt buộc và không được để trống.",
  },
  "jobs.wizard.field.department": { en: "Department", vi: "Phòng ban" },
  "jobs.wizard.field.selectDepartment": { en: "Select department…", vi: "Chọn phòng ban…" },
  "jobs.wizard.dept.engineering": { en: "Technology – Engineering", vi: "Công nghệ – Kỹ thuật" },
  "jobs.wizard.dept.search": { en: "Search & Ranking", vi: "Tìm kiếm & Xếp hạng" },
  "jobs.wizard.dept.security": { en: "Security & Trust", vi: "Bảo mật & Tin cậy" },
  "jobs.wizard.dept.data": { en: "Data Science & ML", vi: "Khoa học dữ liệu & ML" },
  "jobs.wizard.dept.product": { en: "Product Management", vi: "Quản lý sản phẩm" },
  "jobs.wizard.dept.design": { en: "Design & UX", vi: "Thiết kế & UX" },
  "jobs.wizard.dept.operations": { en: "Operations", vi: "Vận hành" },
  "jobs.wizard.dept.finance": { en: "Finance & Legal", vi: "Tài chính & Pháp lý" },
  "jobs.wizard.field.location": { en: "Location", vi: "Địa điểm" },
  "jobs.wizard.field.selectLocation": { en: "Select location…", vi: "Chọn địa điểm…" },
  "jobs.wizard.loc.hcmcOnsite": { en: "Ho Chi Minh / On-site", vi: "TP.HCM / Tại văn phòng" },
  "jobs.wizard.loc.hanoiOnsite": { en: "Hanoi / On-site", vi: "Hà Nội / Tại văn phòng" },
  "jobs.wizard.loc.euRemote": { en: "EU / Remote", vi: "EU / Từ xa" },
  "jobs.wizard.loc.usRemote": { en: "US / Remote", vi: "Mỹ / Từ xa" },
  "jobs.wizard.loc.apacRemote": { en: "APAC / Remote", vi: "APAC / Từ xa" },
  "jobs.wizard.loc.globalRemote": { en: "Global / Fully Remote", vi: "Toàn cầu / Hoàn toàn từ xa" },
  "jobs.wizard.loc.vancouverHybrid": { en: "Vancouver / Hybrid", vi: "Vancouver / Kết hợp" },
  "jobs.wizard.loc.londonHybrid": { en: "London / Hybrid", vi: "London / Kết hợp" },
  "jobs.wizard.field.seniority": { en: "Seniority Level", vi: "Cấp bậc" },
  "jobs.wizard.field.selectLevel": { en: "Select level…", vi: "Chọn cấp bậc…" },
  "jobs.wizard.level.intern": { en: "Intern", vi: "Thực tập sinh" },
  "jobs.wizard.level.junior": { en: "Junior (0–2 yrs)", vi: "Junior (0–2 năm)" },
  "jobs.wizard.level.mid": { en: "Mid-level (2–5 yrs)", vi: "Mid-level (2–5 năm)" },
  "jobs.wizard.level.senior": { en: "Senior (5–8 yrs)", vi: "Senior (5–8 năm)" },
  "jobs.wizard.level.staff": { en: "Staff / Principal", vi: "Staff / Principal" },
  "jobs.wizard.level.lead": { en: "Tech Lead", vi: "Tech Lead" },
  "jobs.wizard.level.manager": { en: "Engineering Manager", vi: "Quản lý kỹ thuật" },
  "jobs.wizard.level.director": { en: "Director+", vi: "Giám đốc trở lên" },
  "jobs.wizard.field.targetOpenings": { en: "Target Applicants / Openings", vi: "Chỉ tiêu ứng viên / Số lượng tuyển" },
  "jobs.wizard.field.targetPlaceholder": { en: "e.g. 200", vi: "VD: 200" },
  "jobs.wizard.field.employmentType": { en: "Employment Type", vi: "Hình thức làm việc" },
  "jobs.wizard.field.selectType": { en: "Select type…", vi: "Chọn hình thức…" },
  "jobs.wizard.type.fulltime": { en: "Full-time", vi: "Toàn thời gian" },
  "jobs.wizard.type.parttime": { en: "Part-time", vi: "Bán thời gian" },
  "jobs.wizard.type.intern": { en: "Internship", vi: "Thực tập" },
  "jobs.wizard.type.contract": { en: "Contract", vi: "Hợp đồng" },
  "jobs.wizard.type.freelance": { en: "Freelance", vi: "Tự do" },
  "jobs.wizard.field.workMode": { en: "Work Mode", vi: "Chế độ làm việc" },
  "jobs.wizard.field.selectMode": { en: "Select mode…", vi: "Chọn chế độ…" },
  "jobs.wizard.mode.onsite": { en: "On-site", vi: "Tại văn phòng" },
  "jobs.wizard.mode.hybrid": { en: "Hybrid", vi: "Kết hợp" },
  "jobs.wizard.mode.remote": { en: "Remote", vi: "Từ xa" },
  "jobs.wizard.mode.flexible": { en: "Flexible", vi: "Linh hoạt" },

  // ---- Wizard step 1: skills -----------------------------------------------
  "jobs.wizard.card.skills": { en: "Skills & Expertise", vi: "Kỹ năng & Chuyên môn" },
  "jobs.wizard.skills.must": { en: "Must-Have Skills", vi: "Kỹ năng bắt buộc" },
  "jobs.wizard.skills.required": { en: "Required", vi: "Bắt buộc" },
  "jobs.wizard.skills.mustPlaceholder": {
    en: "Add a required skill (e.g. Python, Docker…)",
    vi: "Thêm kỹ năng bắt buộc (VD: Python, Docker…)",
  },
  "jobs.wizard.skills.nice": { en: "Nice-to-Have Skills", vi: "Kỹ năng ưu tiên" },
  "jobs.wizard.skills.optional": { en: "Optional", vi: "Không bắt buộc" },
  "jobs.wizard.skills.nicePlaceholder": {
    en: "Add a preferred skill (e.g. LLM evaluation, Ray…)",
    vi: "Thêm kỹ năng ưu tiên (VD: đánh giá LLM, Ray…)",
  },

  // ---- Wizard step 1: job content ------------------------------------------
  "jobs.wizard.card.content": { en: "Job Content", vi: "Nội dung tin" },
  "jobs.wizard.content.overview": { en: "Role Overview", vi: "Tổng quan vị trí" },
  "jobs.wizard.content.overviewPlaceholder": {
    en: "Brief summary of the role, the team, and what the candidate will accomplish…",
    vi: "Tóm tắt ngắn về vị trí, đội ngũ, và những gì ứng viên sẽ đạt được…",
  },
  "jobs.wizard.content.responsibilities": { en: "Key Responsibilities", vi: "Trách nhiệm chính" },
  "jobs.wizard.content.responsibilitiesPlaceholder": {
    en: "- Own the design and implementation of…\n- Collaborate with cross-functional teams to…\n- Drive technical decisions across…",
    vi: "- Chịu trách nhiệm thiết kế và triển khai…\n- Phối hợp với các đội liên chức năng để…\n- Dẫn dắt các quyết định kỹ thuật trong…",
  },
  "jobs.wizard.content.requirements": { en: "Requirements", vi: "Yêu cầu" },
  "jobs.wizard.content.requirementsPlaceholder": {
    en: "- 3+ years of experience with…\n- Strong proficiency in Python and…\n- Experience building production ML systems…",
    vi: "- 3+ năm kinh nghiệm với…\n- Thành thạo Python và…\n- Kinh nghiệm xây dựng hệ thống ML chạy thật…",
  },
  "jobs.wizard.content.niceToHave": { en: "Nice-to-Have Qualifications", vi: "Ưu tiên thêm" },
  "jobs.wizard.content.niceToHavePlaceholder": {
    en: "- Familiarity with LLM evaluation frameworks…\n- Prior internship at a tech company…",
    vi: "- Quen với các framework đánh giá LLM…\n- Từng thực tập tại công ty công nghệ…",
  },

  // ---- Wizard step 1: compensation -----------------------------------------
  "jobs.wizard.card.compensation": { en: "Compensation", vi: "Lương thưởng" },
  "jobs.wizard.comp.optional": { en: "(Optional)", vi: "(Không bắt buộc)" },
  "jobs.wizard.comp.min": { en: "Salary Min (USD/yr)", vi: "Lương tối thiểu (USD/năm)" },
  "jobs.wizard.comp.minPlaceholder": { en: "e.g. 80000", vi: "VD: 80000" },
  "jobs.wizard.comp.max": { en: "Salary Max (USD/yr)", vi: "Lương tối đa (USD/năm)" },
  "jobs.wizard.comp.maxPlaceholder": { en: "e.g. 120000", vi: "VD: 120000" },
  "jobs.wizard.comp.hint": {
    en: "Leave blank to hide compensation from the candidate-facing portal.",
    vi: "Để trống nếu không muốn hiện mức lương trên cổng ứng viên.",
  },

  // ---- Wizard: actions & live preview --------------------------------------
  "jobs.wizard.discard": { en: "Discard changes", vi: "Huỷ thay đổi" },
  "jobs.wizard.saveDraft": { en: "Save Draft", vi: "Lưu nháp" },
  "jobs.wizard.toStep2": { en: "Preview Card (Step 2)", vi: "Thẻ xem trước (Bước 2)" },
  "jobs.wizard.livePreview": { en: "Live Preview", vi: "Xem trước trực tiếp" },
  "jobs.wizard.updating": { en: "Updating", vi: "Đang cập nhật" },
  "jobs.wizard.whatCandidatesSee": { en: "What candidates see", vi: "Ứng viên sẽ thấy gì" },
  "jobs.wizard.whatCandidatesSeeBody": {
    en: 'This card appears on the candidate portal. Clicking "Apply Now" opens the full application form with GitHub and LinkedIn enrichment.',
    vi: 'Thẻ này hiển thị trên cổng ứng viên. Bấm "Ứng tuyển ngay" sẽ mở form ứng tuyển đầy đủ kèm làm giàu hồ sơ từ GitHub và LinkedIn.',
  },

  // ---- Wizard step 2: full preview -----------------------------------------
  "jobs.wizard.step2.noTitle": { en: "No position title entered", vi: "Chưa nhập tên vị trí" },
  "jobs.wizard.step2.badge": { en: "Step 2: Preview Card", vi: "Bước 2: Thẻ xem trước" },
  "jobs.wizard.step2.noOverview": { en: "No role overview provided yet...", vi: "Chưa có tổng quan vị trí..." },
  "jobs.wizard.step2.noResponsibilities": { en: "No responsibilities provided yet...", vi: "Chưa có trách nhiệm chính..." },
  "jobs.wizard.step2.noRequirements": { en: "No requirements provided yet...", vi: "Chưa có yêu cầu..." },
  "jobs.wizard.step2.noSkills": { en: "No required skills added", vi: "Chưa thêm kỹ năng bắt buộc" },
  "jobs.wizard.step2.back": { en: "← Back to Edit (Step 1)", vi: "← Quay lại chỉnh sửa (Bước 1)" },
  "jobs.wizard.step2.next": {
    en: "Proceed to Candidate View Portal (Step 3)",
    vi: "Tiếp tục tới Cổng ứng viên (Bước 3)",
  },

  // ---- Wizard step 3: candidate portal -------------------------------------
  "jobs.wizard.step3.title": { en: "Step 3: Candidate View Portal", vi: "Bước 3: Cổng ứng viên" },
  "jobs.wizard.step3.subtitle": {
    en: "Public candidate application portal for job position",
    vi: "Cổng ứng tuyển công khai của vị trí này",
  },
  "jobs.wizard.step3.portalMode": { en: "Portal Mode", vi: "Chế độ cổng" },
  "jobs.wizard.step3.hint.click": { en: "Click", vi: "Bấm" },
  "jobs.wizard.step3.hint.or": { en: "or", vi: "hoặc" },
  "jobs.wizard.step3.hint.publish": { en: "Publish", vi: "Đăng tin" },
  "jobs.wizard.step3.hint.tail": {
    en: "to generate a public application link for candidates.",
    vi: "để tạo link ứng tuyển công khai cho ứng viên.",
  },
  "jobs.wizard.step3.back": { en: "← Back to Preview Card (Step 2)", vi: "← Quay lại Thẻ xem trước (Bước 2)" },
  "jobs.wizard.step3.publishBlocked": {
    en: "Add at least one Tech Lead to the review panel first",
    vi: "Hãy thêm ít nhất một Tech Lead vào hội đồng chấm trước",
  },
  "jobs.wizard.step3.publish": { en: "Publish & Open Applications", vi: "Đăng tin & Mở nhận hồ sơ" },
} satisfies Record<string, Message>;
