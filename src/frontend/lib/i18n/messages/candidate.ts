import type { Message } from "./index";

/**
 * Namespace "candidate" — màn hình hồ sơ ứng viên đã làm giàu
 * (app/candidate-profile/enriched) và ba component dùng chung của nó:
 * CandidateCvPanel, SkillMatchPanel, AgentChatDrawer.
 *
 * Mỗi key mang cả EN lẫn VI. Bản tiếng Anh phải GIỮ NGUYÊN chuỗi cũ trong
 * component: test đơn vị render không có provider và khớp đúng các chuỗi đó
 * ("No CV is attached to this candidate.", "Open agent chat", …).
 *
 * Ba key "candidate.applyingFor" / "candidate.generalApplication" /
 * "candidate.anonymous" nằm ở common.ts vì dashboard và trang tìm kiếm cũng
 * dùng — đừng khai lại ở đây, i18n.test.ts bắt key trùng.
 */
export const candidateMessages = {
  // ── Trang: tải / lỗi / banner / tab ──────────────────────────────────────
  "candidate.enriching": { en: "Enriching candidate profile...", vi: "Đang làm giàu hồ sơ ứng viên..." },
  "candidate.enrichmentFailed": { en: "Enrichment failed", vi: "Làm giàu hồ sơ thất bại" },
  "candidate.noPermission": {
    en: "Your account does not have permission to view candidate profiles. This screen is for HR and Tech Lead.",
    vi: "Tài khoản của bạn không có quyền xem hồ sơ ứng viên. Màn hình này dành cho HR và Tech Lead.",
  },
  "candidate.sessionExpired": {
    en: "Your session has expired. Please sign in again.",
    vi: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  },
  "candidate.techReviewBanner": {
    en: "Technical Review — PII restricted per ABAC policy",
    vi: "Đánh giá kỹ thuật — thông tin cá nhân được che theo chính sách ABAC",
  },
  "candidate.tab.parsed": { en: "Parsed profile", vi: "Hồ sơ đã bóc tách" },

  // ── CV gốc (CandidateCvPanel + nút mở CV) ────────────────────────────────
  "candidate.cv.originalCv": { en: "Original CV", vi: "CV gốc" },
  "candidate.cv.titleFor": { en: "{name} — CV", vi: "{name} — CV" },
  "candidate.cv.viewOriginal": { en: "View Original CV", vi: "Xem CV gốc" },
  "candidate.cv.couldNotOpen": { en: "Could not open this CV.", vi: "Không mở được CV này." },
  "candidate.cv.couldNotLoad": { en: "Could not load the CV.", vi: "Không tải được CV." },
  "candidate.cv.loading": { en: "Loading the document…", vi: "Đang tải tài liệu…" },
  "candidate.cv.missing": { en: "No CV is attached to this candidate.", vi: "Ứng viên này chưa đính kèm CV." },
  "candidate.cv.frameTitle": { en: "Candidate CV", vi: "CV của ứng viên" },

  // ── Cột phải: Unified Candidate Analytics ────────────────────────────────
  "candidate.analytics.title": { en: "Unified Candidate Analytics", vi: "Phân tích tổng hợp ứng viên" },
  "candidate.analytics.postEnrichmentTag": { en: "post-enrichment", vi: "sau làm giàu" },
  "candidate.analytics.live": { en: "LIVE", vi: "TRỰC TIẾP" },
  "candidate.analytics.matchConfidenceScore": { en: "Match Confidence Score", vi: "Điểm độ tin cậy phù hợp" },
  "candidate.analytics.requirementsBreakdown": { en: "Requirements Breakdown", vi: "Phân tích yêu cầu" },
  "candidate.analytics.impactSummary": { en: "Enrichment Impact Summary", vi: "Tóm tắt tác động của làm giàu" },
  "candidate.analytics.reposCorroborating": { en: "Repos Corroborating", vi: "Repo đối chứng" },
  "candidate.analytics.reposCorroboratingSub": { en: "public repositories", vi: "repo công khai" },
  "candidate.analytics.rolesVerified": { en: "Roles Verified", vi: "Vị trí đã xác minh" },
  "candidate.analytics.rolesVerifiedSub": { en: "LinkedIn employment entries", vi: "mục kinh nghiệm trên LinkedIn" },
  "candidate.analytics.skillsConfirmed": { en: "Skills Confirmed", vi: "Kỹ năng đã xác nhận" },
  "candidate.analytics.skillsConfirmedSub": { en: "from README analysis", vi: "từ phân tích README" },
  "candidate.analytics.sources": { en: "Sources:", vi: "Nguồn:" },
  "candidate.analytics.sourceGithub": { en: "GitHub ({n} repos analyzed)", vi: "GitHub ({n} repo đã phân tích)" },
  "candidate.analytics.sourceLinkedin": {
    en: "LinkedIn ({n} verified positions)",
    vi: "LinkedIn ({n} vị trí đã xác minh)",
  },
  "candidate.analytics.scheduleInterview": { en: "Schedule Interview", vi: "Đặt lịch phỏng vấn" },
  "candidate.analytics.waitingForTls": {
    en: "⏳ Waiting for the Tech Lead panel to approve before scheduling",
    vi: "⏳ Chờ hội đồng Tech Lead duyệt trước khi đặt lịch",
  },
  "candidate.analytics.rejected": {
    en: "❌ Candidate rejected — scheduling unavailable",
    vi: "❌ Ứng viên đã bị từ chối — không thể đặt lịch",
  },
  "candidate.analytics.submitHrDecision": {
    en: "⚠️ Submit your final HR decision above",
    vi: "⚠️ Gửi quyết định cuối cùng của HR ở phía trên",
  },
  "candidate.analytics.submitReview": { en: "Submit your review above", vi: "Gửi đánh giá của bạn ở phía trên" },

  // ── Match Confidence ─────────────────────────────────────────────────────
  "candidate.match.title": { en: "Match Confidence", vi: "Độ tin cậy phù hợp" },
  "candidate.match.increase": {
    en: "+{n} increase from external data enrichment",
    vi: "+{n} tăng nhờ làm giàu dữ liệu từ nguồn ngoài",
  },
  "candidate.match.experienceFit": { en: "Experience Fit", vi: "Phù hợp kinh nghiệm" },
  "candidate.match.skillsAlignment": { en: "Skills Alignment", vi: "Khớp kỹ năng" },
  "candidate.match.cultureSignal": { en: "Culture Signal", vi: "Tín hiệu văn hoá" },

  // ── SkillMatchPanel ──────────────────────────────────────────────────────
  "candidate.skills.empty": {
    en: "No skill breakdown yet — run enrichment for this candidate to generate one.",
    vi: "Chưa có phân tích kỹ năng — hãy chạy làm giàu hồ sơ cho ứng viên này để tạo.",
  },
  "candidate.skills.aria": { en: "Skill match breakdown", vi: "Phân tích mức khớp kỹ năng" },
  "candidate.skills.requiredMatched": { en: "Required — matched", vi: "Bắt buộc — đã khớp" },
  "candidate.skills.requiredMissing": { en: "Required — missing", vi: "Bắt buộc — còn thiếu" },
  "candidate.skills.noneMissing": {
    en: "None — every required skill is covered",
    vi: "Không thiếu — đã đáp ứng mọi kỹ năng bắt buộc",
  },
  "candidate.skills.niceToHaveMatched": { en: "Nice to have — matched", vi: "Ưu tiên — đã khớp" },
  "candidate.skills.beyondPosting": { en: "Beyond the posting", vi: "Ngoài yêu cầu tin tuyển dụng" },
  "candidate.skills.overallMatch": { en: "overall match", vi: "mức khớp tổng thể" },
  "candidate.skills.requiredCount": {
    en: "{matched}/{total} required skills",
    vi: "{matched}/{total} kỹ năng bắt buộc",
  },

  // ── Radar: Technical Skill Matrix ────────────────────────────────────────
  "candidate.radar.title": { en: "Technical Skill Matrix", vi: "Ma trận kỹ năng kỹ thuật" },
  "candidate.radar.subtitle": {
    en: "Multi-axis competency · enriched with external repository data",
    vi: "Năng lực đa trục · làm giàu bằng dữ liệu repo bên ngoài",
  },
  "candidate.radar.showDelta": { en: "Show delta", vi: "Hiện chênh lệch" },
  "candidate.radar.baseline": { en: "Baseline", vi: "Ban đầu" },
  "candidate.radar.enriched": { en: "Enriched", vi: "Sau làm giàu" },
  "candidate.radar.delta": { en: "Delta", vi: "Chênh lệch" },
  "candidate.radar.legendPre": { en: "Pre-enrichment", vi: "Trước làm giàu" },
  "candidate.radar.legendPost": { en: "Post-enrichment", vi: "Sau làm giàu" },

  // ── Career Trajectory ────────────────────────────────────────────────────
  "candidate.career.title": { en: "Career Trajectory", vi: "Lộ trình sự nghiệp" },
  "candidate.career.subtitle": {
    en: "Verified chronological milestones · LinkedIn cross-referenced",
    vi: "Các mốc thời gian đã xác minh · đối chiếu với LinkedIn",
  },
  "candidate.career.now": { en: "NOW", vi: "HIỆN TẠI" },
  "candidate.career.edu": { en: "EDU", vi: "HỌC VẤN" },
  "candidate.career.verified": { en: "Verified", vi: "Đã xác minh" },
  "candidate.career.empty": {
    en: "No career trajectory data available from LinkedIn enrichment",
    vi: "Chưa có dữ liệu lộ trình sự nghiệp từ làm giàu LinkedIn",
  },

  // ── Cột giữa: Enrichment Panel ───────────────────────────────────────────
  "candidate.enrichment.title": { en: "Cross-Channel Enrichment Status", vi: "Trạng thái làm giàu đa kênh" },
  "candidate.enrichment.aiEnriched": { en: "AI-Enriched", vi: "AI làm giàu" },
  "candidate.enrichment.sourceCount": { en: "2 sources", vi: "2 nguồn" },
  "candidate.enrichment.profileTitle": { en: "Enriched candidate profile", vi: "Hồ sơ ứng viên đã làm giàu" },
  "candidate.enrichment.profileSubtitle": {
    en: "Real GitHub and LinkedIn payload rendered from enrichment response",
    vi: "Dữ liệu GitHub và LinkedIn thật, lấy từ kết quả làm giàu",
  },
  "candidate.enrichment.screening": { en: "Screening", vi: "Sàng lọc" },
  "candidate.enrichment.integrations": { en: "External Platform Integrations", vi: "Tích hợp nền tảng bên ngoài" },
  "candidate.enrichment.autoSync": { en: "Automated Synchronization:", vi: "Đồng bộ tự động:" },
  "candidate.enrichment.syncState": { en: "IDLE / UP-TO-DATE", vi: "RẢNH / ĐÃ CẬP NHẬT" },
  "candidate.enrichment.lastSync": { en: "Last sync: Just now", vi: "Đồng bộ lần cuối: Vừa xong" },
  "candidate.enrichment.disclaimer": {
    en: "Data enrichment is based on publicly available sources. Manual verification recommended for final hiring decisions.",
    vi: "Dữ liệu làm giàu dựa trên các nguồn công khai. Nên kiểm tra thủ công trước khi ra quyết định tuyển dụng cuối cùng.",
  },
  "candidate.connected": { en: "Connected", vi: "Đã kết nối" },

  // ── GitHub card ──────────────────────────────────────────────────────────
  "candidate.github.unavailable": { en: "repository data unavailable", vi: "chưa có dữ liệu repo" },
  "candidate.github.publicRepos": { en: "Public Repos Analyzed", vi: "Repo công khai đã phân tích" },
  "candidate.github.topLanguages": { en: "Top Languages", vi: "Ngôn ngữ chính" },
  "candidate.github.noLanguages": {
    en: "No repository language data available yet.",
    vi: "Chưa có dữ liệu ngôn ngữ của repo.",
  },
  "candidate.github.readmeTitle": {
    en: "Latest README.md Semantic Extraction",
    vi: "Trích xuất ngữ nghĩa từ README.md mới nhất",
  },
  "candidate.github.readmeSkills": {
    en: "Corroborated skills extracted from README: {tags}.",
    vi: "Kỹ năng được đối chứng qua README: {tags}.",
  },
  "candidate.github.noReadme": {
    en: "No README content available yet for semantic extraction.",
    vi: "Chưa có nội dung README để trích xuất ngữ nghĩa.",
  },

  // ── LinkedIn card ────────────────────────────────────────────────────────
  "candidate.linkedin.unavailable": { en: "LinkedIn data unavailable", vi: "Chưa có dữ liệu LinkedIn" },
  "candidate.linkedin.verifiedHistory": { en: "Verified Employment History", vi: "Lịch sử làm việc đã xác minh" },
  "candidate.linkedin.rolesMapped": {
    en: "{n} roles mapped from LinkedIn profile",
    vi: "{n} vị trí lấy từ hồ sơ LinkedIn",
  },
  "candidate.linkedin.noHistory": {
    en: "No LinkedIn employment history available",
    vi: "Chưa có lịch sử làm việc trên LinkedIn",
  },
  "candidate.linkedin.profileInfo": { en: "Profile Information", vi: "Thông tin hồ sơ" },
  "candidate.linkedin.name": { en: "Name:", vi: "Tên:" },
  "candidate.linkedin.headline": { en: "Headline:", vi: "Tiêu đề:" },
  "candidate.linkedin.workExperience": { en: "Work Experience", vi: "Kinh nghiệm làm việc" },
  "candidate.linkedin.current": { en: "Current", vi: "Hiện tại" },

  // ── Review panel ─────────────────────────────────────────────────────────
  "candidate.review.title": { en: "CV Review", vi: "Đánh giá CV" },
  "candidate.review.submitFailed": { en: "Could not submit the review.", vi: "Không gửi được đánh giá." },
  "candidate.review.loadingStatus": { en: "⏳ Loading review status…", vi: "⏳ Đang tải trạng thái đánh giá…" },
  "candidate.review.hrBlocked": {
    en: "⏳ Waiting for the Tech Lead panel — {required} of {total} must approve",
    vi: "⏳ Chờ hội đồng Tech Lead — cần {required}/{total} người duyệt",
  },
  "candidate.review.approve": { en: "✓ Approve", vi: "✓ Duyệt" },
  "candidate.review.reject": { en: "✗ Reject", vi: "✗ Từ chối" },
  "candidate.review.notesPlaceholder": {
    en: "Add notes (required if rejecting)…",
    vi: "Thêm ghi chú (bắt buộc nếu từ chối)…",
  },
  "candidate.review.submitting": { en: "Submitting…", vi: "Đang gửi…" },
  "candidate.review.submit": { en: "Submit Review", vi: "Gửi đánh giá" },
  "candidate.review.yourDecision": { en: "Your decision:", vi: "Quyết định của bạn:" },
  "candidate.review.notSubmitted": { en: "Not submitted", vi: "Chưa gửi" },
  "candidate.review.approved": { en: "Approved", vi: "Đã duyệt" },
  "candidate.review.rejected": { en: "Rejected", vi: "Đã từ chối" },
  "candidate.review.tlPanel": { en: "Tech Lead panel:", vi: "Hội đồng Tech Lead:" },
  "candidate.review.tlApproved": { en: "{approved}/{required} approved", vi: "{approved}/{required} đã duyệt" },
  "candidate.review.tlRejected": { en: " · {n} rejected", vi: " · {n} từ chối" },
  "candidate.review.hr": { en: "HR:", vi: "HR:" },
  "candidate.review.waiting": { en: "Waiting…", vi: "Đang chờ…" },
  "candidate.review.techLead": { en: "Tech Lead", vi: "Tech Lead" },
  "candidate.review.hrNotes": { en: "HR's notes:", vi: "Ghi chú của HR:" },
  "candidate.review.status.waitingForTls": {
    en: "⏳ Waiting for the Tech Lead panel…",
    vi: "⏳ Đang chờ hội đồng Tech Lead…",
  },
  "candidate.review.status.waitingForHr": {
    en: "⚠️ Tech Leads approved — waiting for HR",
    vi: "⚠️ Tech Lead đã duyệt — đang chờ HR",
  },
  "candidate.review.status.ready": { en: "✅ Approved — ready to schedule", vi: "✅ Đã duyệt — sẵn sàng đặt lịch" },
  "candidate.review.status.rejectedByTls": {
    en: "❌ Rejected by the Tech Lead panel",
    vi: "❌ Bị hội đồng Tech Lead từ chối",
  },
  "candidate.review.status.rejectedByHr": {
    en: "❌ Rejected by HR — notification sent",
    vi: "❌ Bị HR từ chối — đã gửi thông báo",
  },

  // ── Agent chat drawer (chỉ nhãn giao diện, không phải nội dung agent) ────
  "candidate.chat.open": { en: "Open agent chat", vi: "Mở chat với agent" },
  "candidate.chat.aria": { en: "Agent chat", vi: "Chat với agent" },
  "candidate.chat.title": { en: "ATS Agent", vi: "Trợ lý ATS" },
  "candidate.chat.minimizeAria": { en: "Minimize agent chat", vi: "Thu nhỏ chat với agent" },
  "candidate.chat.minimize": { en: "Minimize", vi: "Thu nhỏ" },
  "candidate.chat.closeAria": { en: "Close agent chat", vi: "Đóng chat với agent" },
  "candidate.chat.empty": {
    en: "Ask the agent to search candidates or explain a recommendation.",
    vi: "Nhờ agent tìm ứng viên hoặc giải thích một đề xuất.",
  },
  "candidate.chat.thinking": { en: "Agent is thinking...", vi: "Agent đang suy nghĩ..." },
  "candidate.chat.placeholder": { en: "Ask the agent...", vi: "Hỏi agent..." },
  "candidate.chat.sendAria": { en: "Send message", vi: "Gửi tin nhắn" },
  "candidate.chat.send": { en: "Send", vi: "Gửi" },
  "candidate.chat.candidateFallback": { en: "Candidate (#{code})", vi: "Ứng viên (#{code})" },
  "candidate.chat.confidence": { en: "Confidence: {pct}%", vi: "Độ tin cậy: {pct}%" },
  "candidate.chat.viewProfile": { en: "View profile", vi: "Xem hồ sơ" },
  "candidate.career.present": { en: "Present", vi: "Hiện tại" },
  "candidate.career.unknownYear": { en: "Unknown", vi: "Không rõ" },
} satisfies Record<string, Message>;
