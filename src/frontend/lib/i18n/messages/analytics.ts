import type { Message } from "./index";

/** Namespace "analytics" — mỗi key mang cả EN lẫn VI. */
export const analyticsMessages = {
  "analytics.title": {
    en: "Recruitment & AI Intelligence Analytics",
    vi: "Phân tích tuyển dụng & trí tuệ AI",
  },
  "analytics.subtitle": {
    en: "Real-time database insights on applicant pipeline, AI matching scores, and skill gap matrix.",
    vi: "Số liệu thời gian thực về quy trình ứng tuyển, điểm khớp AI và ma trận thiếu hụt kỹ năng.",
  },
  "analytics.allPositions": {
    en: "All Positions ({n} Active Jobs)",
    vi: "Tất cả vị trí ({n} tin đang tuyển)",
  },
  "analytics.range.7d": { en: "Last 7 Days", vi: "7 ngày qua" },
  "analytics.range.30d": { en: "Last 30 Days", vi: "30 ngày qua" },
  "analytics.range.quarter": { en: "Quarter to Date", vi: "Từ đầu quý" },
  "analytics.range.all": { en: "All Time", vi: "Toàn bộ thời gian" },
  "analytics.exportReport": { en: "Export Report", vi: "Xuất báo cáo" },

  "analytics.kpi.totalCandidates": { en: "Total Candidates", vi: "Tổng ứng viên" },
  "analytics.kpi.avgMatch": { en: "Avg AI Match", vi: "Điểm khớp AI TB" },
  "analytics.kpi.avgMatchDelta": { en: "+3.2% High", vi: "+3,2% Cao" },
  "analytics.kpi.timeToHire": { en: "Time-to-Hire", vi: "Thời gian tuyển" },
  "analytics.kpi.days": { en: "{n} Days", vi: "{n} ngày" },
  "analytics.kpi.timeToHireDelta": { en: "-2.4d Speed", vi: "Nhanh hơn 2,4 ngày" },
  "analytics.kpi.activeJobs": { en: "Active Job Postings", vi: "Tin đang tuyển" },
  "analytics.kpi.positions": { en: "{n} Positions", vi: "{n} vị trí" },

  "analytics.tab.pipeline": { en: "1. Pipeline & Job Performance", vi: "1. Quy trình & hiệu quả tin tuyển dụng" },
  "analytics.tab.ai": { en: "2. AI Match & Skill Matrix", vi: "2. Điểm khớp AI & ma trận kỹ năng" },
  "analytics.tab.sourcing": { en: "3. Sourcing & Operations", vi: "3. Nguồn ứng viên & vận hành" },

  "analytics.funnel.title": { en: "Recruitment Pipeline Velocity", vi: "Tốc độ quy trình tuyển dụng" },
  "analytics.funnel.subtitle": {
    en: "Tracking candidate progression from initial application to offer acceptance",
    vi: "Theo dõi tiến trình ứng viên từ lúc nộp hồ sơ đến khi nhận offer",
  },
  "analytics.funnel.efficiency": { en: "94.2% Funnel Efficiency", vi: "Hiệu suất phễu 94,2%" },
  "analytics.funnel.avg": { en: "{days} avg", vi: "TB {days}" },
  "analytics.funnel.candidates": { en: "{fraction} Candidates", vi: "{fraction} ứng viên" },
  "analytics.stage.received": { en: "1. Applications Received", vi: "1. Hồ sơ đã nhận" },
  "analytics.stage.receivedNote": { en: "Total Ingested", vi: "Tổng đã nạp" },
  "analytics.stage.analyzed": { en: "2. AI Analyzed", vi: "2. AI đã phân tích" },
  "analytics.stage.analyzedNote": { en: "{unanalyzed}/{total} Unanalyzed", vi: "{unanalyzed}/{total} chưa phân tích" },
  "analytics.stage.passed": { en: "3. Passed AI Match (>75%)", vi: "3. Đạt điểm khớp AI (>75%)" },
  "analytics.stage.passedNote": { en: "Top Tier Candidates", vi: "Ứng viên nhóm đầu" },
  "analytics.stage.cvApproved": { en: "4. CV Reviewed & Approved", vi: "4. CV đã duyệt" },
  "analytics.stage.cvApprovedNote": { en: "Recruiter Approved", vi: "HR đã duyệt" },
  "analytics.stage.interview": { en: "5. Interview Scheduled", vi: "5. Đã đặt lịch phỏng vấn" },
  "analytics.stage.interviewNote": { en: "Scheduled in Calendar", vi: "Đã lên lịch" },

  "analytics.jobs.title": {
    en: "Job Posting Performance (Supabase Live Data)",
    vi: "Hiệu quả tin tuyển dụng (dữ liệu trực tiếp từ Supabase)",
  },
  "analytics.jobs.create": { en: "Create New Position", vi: "Tạo vị trí mới" },
  "analytics.jobs.col.title": { en: "Job Position Title", vi: "Tên vị trí" },
  "analytics.jobs.col.department": { en: "Department", vi: "Phòng ban" },
  "analytics.jobs.col.applications": { en: "Applications Received", vi: "Hồ sơ đã nhận" },
  "analytics.jobs.col.avgMatch": { en: "Avg AI Match", vi: "Điểm khớp AI TB" },
  "analytics.jobs.col.status": { en: "Status", vi: "Trạng thái" },
  "analytics.jobs.empty": { en: "No job postings found.", vi: "Không có tin tuyển dụng nào." },

  "analytics.score.title": { en: "AI Candidate Score Breakdown", vi: "Phân bố điểm AI của ứng viên" },
  "analytics.score.top": { en: "Top Match (85 - 100%)", vi: "Khớp cao nhất (85 - 100%)" },
  "analytics.score.strong": { en: "Strong Match (70 - 84%)", vi: "Khớp tốt (70 - 84%)" },
  "analytics.score.moderate": { en: "Moderate Match (50 - 69%)", vi: "Khớp trung bình (50 - 69%)" },
  "analytics.score.low": { en: "Low Match (< 50%)", vi: "Khớp thấp (< 50%)" },
  "analytics.score.count": { en: "{count}/{total} Candidates ({pct}%)", vi: "{count}/{total} ứng viên ({pct}%)" },

  "analytics.acceptance.title": { en: "Recruiter AI Acceptance Rate", vi: "Tỷ lệ HR chấp nhận gợi ý AI" },
  "analytics.acceptance.desc": {
    en: "Measures how frequently recruiters and tech leads approve and interview candidates recommended as Top Matches by the AI engine.",
    vi: "Đo mức độ thường xuyên HR và Tech Lead duyệt và phỏng vấn những ứng viên được AI xếp vào nhóm khớp cao nhất.",
  },
  "analytics.acceptance.trust": { en: "High Recruiter Trust & Alignment", vi: "Mức tin cậy và đồng thuận cao từ HR" },
  "analytics.acceptance.tip": {
    en: "💡 AI recommendations reduce screening time by an average of 4.5 hours per job posting.",
    vi: "💡 Gợi ý từ AI giúp giảm trung bình 4,5 giờ sàng lọc cho mỗi tin tuyển dụng.",
  },

  "analytics.skills.title": {
    en: "Skill Supply vs. Demand Matrix (Supabase Extraction)",
    vi: "Ma trận cung – cầu kỹ năng (trích xuất từ Supabase)",
  },
  "analytics.skills.subtitle": {
    en: "Extracted from required skills in jobs_posting vs candidate profile skill ratings",
    vi: "Trích từ kỹ năng yêu cầu trong jobs_posting so với đánh giá kỹ năng trên hồ sơ ứng viên",
  },
  "analytics.skills.gapDetected": { en: "Skill Gap Detected", vi: "Phát hiện thiếu hụt kỹ năng" },
  "analytics.skills.shortage": { en: "Shortage (-{gap}%)", vi: "Thiếu hụt (-{gap}%)" },
  "analytics.skills.surplus": { en: "Surplus (+{gap}%)", vi: "Dư thừa (+{gap}%)" },
  "analytics.skills.balanced": { en: "Balanced", vi: "Cân bằng" },
  "analytics.skills.demand": { en: "Job Demand:", vi: "Nhu cầu từ tin tuyển dụng:" },
  "analytics.skills.demandCount": { en: "{n}/{total} Jobs ({pct}%)", vi: "{n}/{total} tin ({pct}%)" },
  "analytics.skills.supply": { en: "Candidate Supply:", vi: "Nguồn cung ứng viên:" },
  "analytics.skills.supplyCount": { en: "{n}/{total} Candidates ({pct}%)", vi: "{n}/{total} ứng viên ({pct}%)" },

  "analytics.channels.title": {
    en: "Candidate Sourcing Channels (Supabase Live)",
    vi: "Kênh nguồn ứng viên (trực tiếp từ Supabase)",
  },
  "analytics.channels.count": { en: "{count}/{total} Candidates ({pct}%)", vi: "{count}/{total} ứng viên ({pct}%)" },
  "analytics.channel.portal": { en: "Public Career Portal", vi: "Cổng tuyển dụng công khai" },
  "analytics.channel.upload": { en: "Direct HR PDF Upload", vi: "HR tải CV PDF trực tiếp" },
  "analytics.channel.referral": { en: "Referral & Public Share Links", vi: "Giới thiệu & link chia sẻ công khai" },

  "analytics.ingestion.title": { en: "AI Ingestion & Parsing Metrics", vi: "Chỉ số nạp & bóc tách CV bằng AI" },
  "analytics.ingestion.desc": {
    en: "PDF parsing performance, text extraction, and automated metadata enrichment stats.",
    vi: "Hiệu năng bóc tách PDF, trích xuất văn bản và thống kê làm giàu siêu dữ liệu tự động.",
  },
  "analytics.ingestion.accuracy": { en: "Parser Extraction Accuracy", vi: "Độ chính xác bóc tách" },
  "analytics.ingestion.parseTime": { en: "Average Parse Time / CV", vi: "Thời gian bóc tách TB / CV" },
  "analytics.ingestion.seconds": { en: "1.15 Seconds", vi: "1,15 giây" },
  "analytics.ingestion.errors": { en: "Parsing Errors / Failures", vi: "Lỗi / thất bại khi bóc tách" },
  "analytics.ingestion.errorCount": { en: "0 Errors", vi: "0 lỗi" },
  "analytics.ingestion.healthy": {
    en: "All CV Ingestion Pipelines operating at optimal performance.",
    vi: "Mọi pipeline nạp CV đang hoạt động ở hiệu năng tối ưu.",
  },
} satisfies Record<string, Message>;
