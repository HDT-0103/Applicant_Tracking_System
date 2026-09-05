import { api } from "./httpClient";

/**
 * Đường đọc dữ liệu danh sách, thay cho việc hỏi thẳng PostgREST.
 *
 * Trình duyệt trước đây `select` trực tiếp vào Supabase bằng anon key. Anon key
 * nằm trong bundle JS công khai, nên khi RLS chưa bật thì bất kỳ ai cũng đọc
 * được cả bảng `candidates` — kể cả các cột EEO. Mà bật RLS lên thì những màn
 * hình đó chết, vì Supabase không giải mã được JWT của ứng dụng (app ký bằng
 * khoá riêng, không dùng Supabase Auth).
 *
 * Đi qua backend gỡ được cả hai: quyền do `require_roles` + hội đồng quyết,
 * PII do `abac.py` che, và cơ sở dữ liệu có thể khoá lại hoàn toàn.
 */

export interface CandidateCard {
  candidate_uuid: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  company: string | null;
  current_location: string | null;
  /** Tên TIN TUYỂN DỤNG ứng viên nộp vào — không phải chức danh của họ. */
  applied_job_title: string | null;
  job_posting_id: string | null;
  match_confidence_score: number | null;
  skills_matrix: Record<string, unknown> | null;
  public_repos_count: number | null;
  top_languages: Record<string, unknown> | null;
}

export interface ConfirmedSlotSummary {
  id: string;
  candidate_uuid: string;
  start_time: string;
  end_time: string | null;
}

export interface DashboardData {
  candidates: CandidateCard[];
  slots: ConfirmedSlotSummary[];
}

export interface CandidateOption {
  candidate_uuid: string;
  full_name: string | null;
}

export interface JobPostingSummary {
  id: string;
  job_title: string;
  status: string;
  applicant_count: number;
}

export interface AnalyticsData {
  jobs: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  candidate_count: number;
  candidates_with_github: number;
  candidates_with_linkedin: number;
  locations: Record<string, number>;
}

export async function getDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>("/api/catalog/dashboard");
}

export async function listCandidateOptions(): Promise<CandidateOption[]> {
  return api.get<CandidateOption[]>("/api/catalog/candidates/options");
}

export async function listJobPostings(): Promise<JobPostingSummary[]> {
  return api.get<JobPostingSummary[]>("/api/catalog/job-postings");
}

export async function deleteJobPosting(jobPostingId: string): Promise<void> {
  await api.delete(`/api/catalog/job-postings/${jobPostingId}`);
}

/**
 * Đổi trạng thái tin. Backend từ chối chuyển sang PUBLISHED nếu chưa có hội
 * đồng chấm — cùng luật với nút Publish ở màn hình tạo tin.
 */
export interface JobPostingDraft {
  job_title: string;
  department: string | null;
  location: string | null;
  seniority_level: string | null;
  employment_type: string | null;
  work_mode: string | null;
  target_openings: number | null;
  salary_min: number | null;
  salary_max: number | null;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  description: string | null;
  key_responsibilities: string | null;
  requirements: string | null;
  nice_to_have_qualifications: string | null;
}

export async function getJobPosting(jobPostingId: string): Promise<Record<string, any>> {
  return api.get<Record<string, any>>(`/api/catalog/job-postings/${jobPostingId}`);
}

/**
 * Lưu nháp. Luôn ở trạng thái DRAFT — đăng tin là thao tác riêng
 * (`setJobPostingStatus`) vì nó có điều kiện: phải có hội đồng chấm.
 */
export async function saveJobPosting(
  draft: JobPostingDraft,
  jobPostingId: string | null,
): Promise<{ id: string }> {
  const body = { ...draft } as Record<string, unknown>;
  return jobPostingId
    ? api.put<{ id: string }>(`/api/catalog/job-postings/${jobPostingId}`, body)
    : api.post<{ id: string }>("/api/catalog/job-postings", body);
}

export async function setJobPostingStatus(
  jobPostingId: string,
  status: "DRAFT" | "PUBLISHED" | "CLOSED",
): Promise<void> {
  await api.patch(`/api/catalog/job-postings/${jobPostingId}/status`, { status });
}

/** Nhân bản một tin. Bản sao luôn là DRAFT và KHÔNG kế thừa hội đồng. */
export async function duplicateJobPosting(
  jobPostingId: string,
): Promise<JobPostingSummary> {
  return api.post<JobPostingSummary>(
    `/api/catalog/job-postings/${jobPostingId}/duplicate`,
  );
}

export async function getAnalytics(): Promise<AnalyticsData> {
  return api.get<AnalyticsData>("/api/catalog/analytics");
}
