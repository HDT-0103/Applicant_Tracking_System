import type { Message } from "./index";

/** Namespace "search" — mỗi key mang cả EN lẫn VI. */
export const searchMessages = {
  "search.title": { en: "Find candidates", vi: "Tìm ứng viên" },
  "search.subtitle": {
    en: "Describe the role in plain language. Candidates are ranked by semantic relevance, not keyword overlap.",
    vi: "Mô tả vị trí bằng lời văn thông thường. Ứng viên được xếp hạng theo mức liên quan ngữ nghĩa, không phải theo từ khoá trùng khớp.",
  },
  "search.error": { en: "The search could not run.", vi: "Không thể thực hiện tìm kiếm." },

  "search.summaryLabel": { en: "What does the role need? *", vi: "Vị trí này cần gì? *" },
  "search.summaryPlaceholder": {
    en: "Senior backend engineer building REST APIs with Python, FastAPI and PostgreSQL…",
    vi: "Kỹ sư backend cấp cao xây dựng REST API với Python, FastAPI và PostgreSQL…",
  },
  "search.experienceLabel": { en: "Experience expectations", vi: "Yêu cầu kinh nghiệm" },
  "search.experiencePlaceholder": {
    en: "3+ years in production backend work, cloud deployment",
    vi: "3+ năm làm backend trên môi trường production, triển khai cloud",
  },
  "search.mustHaveLabel": { en: "Must-have skills", vi: "Kỹ năng bắt buộc" },
  "search.mustHaveHint": {
    en: "A hard filter — a candidate missing any of these is excluded no matter how well the rest matches.",
    vi: "Bộ lọc cứng — ứng viên thiếu bất kỳ kỹ năng nào trong đây sẽ bị loại, dù phần còn lại khớp đến đâu.",
  },
  "search.skillPlaceholder": { en: "Python", vi: "Python" },
  "search.add": { en: "Add", vi: "Thêm" },
  "search.removeSkill": { en: "Remove {skill}", vi: "Bỏ {skill}" },
  "search.resultsLabel": { en: "Results", vi: "Số kết quả" },
  "search.searching": { en: "Searching…", vi: "Đang tìm…" },
  "search.search": { en: "Search", vi: "Tìm kiếm" },

  "search.countOf": { en: "{visible} of {total} candidates", vi: "{visible} trên {total} ứng viên" },
  "search.minMatch": { en: "Minimum match", vi: "Mức khớp tối thiểu" },
  "search.minMatchAria": { en: "Minimum match score", vi: "Điểm khớp tối thiểu" },
  "search.noMatch": {
    en: "No candidate matched this description.",
    vi: "Không có ứng viên nào khớp với mô tả này.",
  },
  "search.noneAbove": {
    en: "No candidate scores above {pct}%. Lower the threshold to see the rest.",
    vi: "Không có ứng viên nào đạt trên {pct}%. Hạ ngưỡng xuống để xem phần còn lại.",
  },

  "search.relevanceTitle": { en: "Semantic relevance {pct}%", vi: "Độ liên quan ngữ nghĩa {pct}%" },
  "search.matchBadge": { en: "MATCH", vi: "KHỚP" },
  "search.summaryHidden": {
    en: "Summary hidden — identifying text is masked for technical reviewers",
    vi: "Tóm tắt bị ẩn — nội dung có thể nhận dạng được che với người chấm kỹ thuật",
  },
  "search.strengths": { en: "Strengths", vi: "Điểm mạnh" },
  "search.gaps": { en: "Gaps", vi: "Điểm thiếu" },
} satisfies Record<string, Message>;
